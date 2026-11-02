package agent

import (
	"context"
	"errors"
	"strconv"
	"sync"
	"time"

	"trizpyy/internal/app"
	"trizpyy/internal/domain"
)

var errTakenOver = errors.New("operator took over")

// timeline persists agent steps and streams them to the operator and the traveler.
type timeline struct {
	core   *app.Core
	runID  string
	tripID string
	owner  string
	delay  time.Duration
	mu     sync.Mutex
	n      int
}

type stepResult struct {
	Status string
	Result string
	Detail []string
	TookMs *int
}

func (tl *timeline) publish(st domain.AgentStep) {
	tl.core.Hub.Publish(app.TripEvent("agent.step", tl.tripID, tl.owner, map[string]any{"runId": tl.runID, "step": st}))
}

func (tl *timeline) nextID() string {
	tl.n++
	return tl.runID + "-s" + strconv.Itoa(tl.n)
}

func (tl *timeline) checkTakeover(ctx context.Context) error {
	if ctx.Err() != nil {
		return errTakenOver
	}
	r, err := tl.core.Store.GetRun(context.WithoutCancel(ctx), tl.runID)
	if err == nil && r.Status == domain.RunNeedsHuman {
		return errTakenOver
	}
	return nil
}

// step shows a running step, does the work, then marks it done (paced so the UI can follow).
func (tl *timeline) step(ctx context.Context, tool, label, kind string, work func() (stepResult, error)) error {
	if err := tl.checkTakeover(ctx); err != nil {
		return err
	}
	tl.mu.Lock()
	st := domain.AgentStep{ID: tl.nextID(), Tool: tool, Label: label, Status: domain.StepRunning, TS: tl.core.Now().UTC(), Kind: kind}
	_, err := tl.core.Store.InsertStep(context.WithoutCancel(ctx), tl.runID, st)
	tl.mu.Unlock()
	if err != nil {
		return err
	}
	tl.publish(st)
	start := time.Now()
	res, err := work()
	if err != nil {
		st.Status, st.Result = domain.StepFailed, err.Error()
		_ = tl.core.Store.UpdateStep(context.WithoutCancel(ctx), st)
		tl.publish(st)
		return err
	}
	if wait := tl.delay - time.Since(start); wait > 0 {
		select {
		case <-time.After(wait):
		case <-ctx.Done():
		}
	}
	st.Status = res.Status
	if st.Status == "" {
		st.Status = domain.StepDone
	}
	st.Result, st.Detail = res.Result, res.Detail
	took := int(time.Since(start).Milliseconds())
	if res.TookMs != nil {
		took = *res.TookMs
	}
	st.TookMs = &took
	if err := tl.core.Store.UpdateStep(context.WithoutCancel(ctx), st); err != nil {
		return err
	}
	tl.publish(st)
	return nil
}

// note records an instant step (vendor replies arrive concurrently, so this is locked).
func (tl *timeline) note(ctx context.Context, st domain.AgentStep) domain.AgentStep {
	tl.mu.Lock()
	defer tl.mu.Unlock()
	st.ID, st.TS = tl.nextID(), tl.core.Now().UTC()
	if _, err := tl.core.Store.InsertStep(context.WithoutCancel(ctx), tl.runID, st); err != nil {
		return st
	}
	tl.publish(st)
	return st
}

func (tl *timeline) patch(ctx context.Context, st domain.AgentStep) {
	if err := tl.core.Store.UpdateStep(context.WithoutCancel(ctx), st); err == nil {
		tl.publish(st)
	}
}
