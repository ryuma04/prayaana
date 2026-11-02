package trips

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"trizpyy/internal/ai"
	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

// Chat returns the trip's in-app conversation (updates, documents, assistant and operator replies).
func (s *Service) Chat(ctx context.Context, p auth.Principal, tripID string) (domain.InboxThread, error) {
	if _, err := s.Authorize(ctx, p, tripID); err != nil {
		return domain.InboxThread{}, err
	}
	th, err := s.Store.Thread(ctx, app.TravelerThreadID(tripID))
	if errors.Is(err, store.ErrNotFound) {
		return domain.InboxThread{ID: app.TravelerThreadID(tripID), Party: "traveler", TripID: tripID, Messages: []domain.InboxMessage{}}, nil
	}
	return th, err
}

type ChatInput struct {
	Text  string `json:"text"`
	Voice bool   `json:"voice"` // the text is a voice-note transcript
}

type ChatReply struct {
	Sent       domain.InboxMessage `json:"sent"`
	Reply      domain.InboxMessage `json:"reply"`
	Understood ai.Assist           `json:"understood"`
}

// SendChat is the traveler writing to the trip assistant. The AI answers from the real trip (plan,
// today's schedule, stay, coordinator, live weather) and suggests a one-tap action; operators see
// the whole conversation in their inbox and can step in.
func (s *Service) SendChat(ctx context.Context, p auth.Principal, tripID string, in ChatInput) (ChatReply, error) {
	owner, err := s.Authorize(ctx, p, tripID)
	if err != nil {
		return ChatReply{}, err
	}
	text := strings.TrimSpace(in.Text)
	if text == "" {
		return ChatReply{}, httpx.BadRequest("Write or say what's happening.")
	}
	text = trimText(text, 1000)
	t, err := s.Store.GetTrip(ctx, tripID)
	if err != nil {
		return ChatReply{}, err
	}
	var history []ai.Turn
	if th, err := s.Store.Thread(ctx, app.TravelerThreadID(tripID)); err == nil {
		msgs := th.Messages
		if len(msgs) > 8 {
			msgs = msgs[len(msgs)-8:]
		}
		for _, m := range msgs {
			from := map[string]string{"them": "traveler", "agent": "assistant", "us": "operator"}[m.From]
			body := m.Body
			if m.Transcript != "" {
				body = m.Transcript
			}
			if m.Type != "attachment" {
				history = append(history, ai.Turn{From: from, Text: body})
			}
		}
	}
	answer := s.AI.TripAssistant(ctx, s.tripFacts(ctx, t), history, text)
	var out ChatReply
	err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		msg := domain.InboxMessage{Type: "text", Body: text}
		if in.Voice {
			msg.Type, msg.Body, msg.Transcript = "voice", "Voice note", text
		}
		msg.Decision = fmt.Sprintf("%s · seriousness %d/5 · %s", answer.Kind, answer.Seriousness, answer.Engine)
		msg.Confidence = &answer.Confidence
		if out.Sent, err = s.TravelerSays(ctx, st, ev, t, owner, msg); err != nil {
			return err
		}
		if out.Reply, err = s.ReplyToTraveler(ctx, st, ev, t, owner, domain.InboxMessage{From: "agent", Type: "text", Body: answer.Reply}); err != nil {
			return err
		}
		if answer.Seriousness >= 4 || answer.Kind == "unwell" {
			return s.NotifyOperators(ctx, st, ev, "risk", t.Code+": traveler needs help", "“"+trimText(text, 140)+"”", "/ops/inbox")
		}
		return nil
	})
	out.Understood = answer
	return out, err
}

// tripFacts is the context the assistant may use: only real data from this trip.
func (s *Service) tripFacts(ctx context.Context, t *domain.Trip) string {
	var b strings.Builder
	today := s.Today()
	dest := s.Eng.Cat.Destination(t.DestinationID)
	destName := t.DestinationID
	if dest != nil {
		destName = dest.Name + ", " + dest.State
	}
	fmt.Fprintf(&b, "Trip %s · %s · %s · %d nights from %s · %d adults, %d kids · status %s\n", t.Code, t.Title, destName, t.Prefs.Nights,
		engine.DayDate(t.Prefs.StartDate, 1), t.Prefs.Adults, t.Prefs.Kids, t.Status)
	fmt.Fprintf(&b, "Local time now: %s on %s\n", engine.MinToTime(s.NowMin()), today)
	current := 0
	if d := engine.DaysBetween(t.Prefs.StartDate, today); d >= 0 && d <= t.Prefs.Nights {
		current = d + 1
		fmt.Fprintf(&b, "Today is day %d of the trip.\n", current)
	}
	if st := s.Eng.Cat.Stay(t.StayID); st != nil {
		fmt.Fprintf(&b, "Stay: %s (%s)\n", st.Name, st.Area)
	}
	if tr := s.Eng.Cat.TransportOption(t.TransportID); tr != nil {
		fmt.Fprintf(&b, "Getting there: %s, departs %s from %s\n", tr.Label, tr.Departs, tr.From)
	}
	if t.CoordinatorID != "" {
		if team, err := s.Store.ListTeam(ctx); err == nil {
			for _, m := range team {
				if m.ID == t.CoordinatorID {
					fmt.Fprintf(&b, "Coordinator: %s, %s\n", m.Name, m.Phone)
				}
			}
		}
	}
	if dest != nil {
		for _, e := range dest.Emergency {
			fmt.Fprintf(&b, "Emergency: %s %s\n", e.Label, e.Phone)
		}
	}
	for day := 1; day <= t.Prefs.Days(); day++ {
		if current > 0 && (day < current || day > current+1) {
			continue
		}
		w := s.Eng.TripDayWeather(t, day)
		src := "climate average"
		if w.Source != "" {
			src = "live forecast"
		}
		fmt.Fprintf(&b, "\nDay %d (%s) · weather %s, %d°C, %d%% rain (%s):\n", day, engine.DayDate(t.Prefs.StartDate, day), w.Condition, w.TempC, w.RainChance, src)
		for _, it := range engine.DayItems(t.Items, day) {
			if !engine.IsActive(it) {
				continue
			}
			heart := ""
			if it.Hearted {
				heart = " (Must-Do)"
			}
			fmt.Fprintf(&b, "- %s %s (%s)%s at %s · %s%s\n", engine.MinToTime(it.StartMin), it.Title, engine.Duration(it.DurationMin), heart, it.Place, it.Status, noteOf(it))
		}
	}
	return b.String()
}

func noteOf(it domain.TripItem) string {
	if it.Note == "" {
		return ""
	}
	return " · " + it.Note
}
