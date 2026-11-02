package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
)

// Error is an error that maps to an HTTP response. Anything else becomes a 500
// whose details are logged but never leaked to clients.
type Error struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func (e *Error) Error() string { return e.Message }

func E(status int, code, msg string) *Error { return &Error{Status: status, Code: code, Message: msg} }

func BadRequest(msg string) *Error { return E(http.StatusBadRequest, "validation", msg) }

// Invalid reports per-field validation errors so forms can show them next to each input.
func Invalid(fields map[string]string) *Error {
	msg := "Please fix the highlighted fields."
	for _, k := range []string{"name", "email", "password", "phone", "code"} {
		if m, ok := fields[k]; ok {
			msg = m
			break
		}
	}
	return &Error{Status: http.StatusUnprocessableEntity, Code: "validation", Message: msg, Fields: fields}
}
func NotFound(msg string) *Error     { return E(http.StatusNotFound, "not_found", msg) }
func Forbidden(msg string) *Error    { return E(http.StatusForbidden, "forbidden", msg) }
func Unauthorized(msg string) *Error { return E(http.StatusUnauthorized, "unauthorized", msg) }
func Conflict(msg string) *Error     { return E(http.StatusConflict, "conflict", msg) }
func Unavailable(msg string) *Error  { return E(http.StatusUnprocessableEntity, "unavailable", msg) }

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Warn("write response", "err", err)
	}
}

func OK(w http.ResponseWriter, v any) { JSON(w, http.StatusOK, v) }

func Created(w http.ResponseWriter, v any) { JSON(w, http.StatusCreated, v) }

func Fail(w http.ResponseWriter, r *http.Request, err error) {
	var he *Error
	if errors.As(err, &he) {
		JSON(w, he.Status, map[string]any{"error": he})
		return
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		JSON(w, http.StatusServiceUnavailable, map[string]any{"error": E(http.StatusServiceUnavailable, "timeout", "The request took too long. Please try again.")})
		return
	}
	slog.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
	JSON(w, http.StatusInternalServerError, map[string]any{"error": E(http.StatusInternalServerError, "internal", "Something went wrong on our side. Please try again.")})
}

const maxBody = 1 << 20

// Decode reads a JSON body into v with a size limit and clear validation errors.
func Decode(r *http.Request, v any) error {
	body := http.MaxBytesReader(nil, r.Body, maxBody)
	dec := json.NewDecoder(body)
	if err := dec.Decode(v); err != nil {
		var syn *json.SyntaxError
		var typ *json.UnmarshalTypeError
		var tooBig *http.MaxBytesError
		switch {
		case errors.Is(err, io.EOF):
			return BadRequest("Request body is empty.")
		case errors.As(err, &syn):
			return BadRequest("Request body is not valid JSON.")
		case errors.As(err, &typ):
			return BadRequest(fmt.Sprintf("Field %q has the wrong type.", typ.Field))
		case errors.As(err, &tooBig):
			return E(http.StatusRequestEntityTooLarge, "too_large", "Request body is too large.")
		}
		return BadRequest("Could not read request body.")
	}
	return nil
}

// DecodeOptional is Decode but treats an empty body as "no fields".
func DecodeOptional(r *http.Request, v any) error {
	if r.ContentLength == 0 {
		return nil
	}
	err := Decode(r, v)
	var he *Error
	if errors.As(err, &he) && he.Message == "Request body is empty." {
		return nil
	}
	return err
}

func QueryInt(r *http.Request, key string, def, lo, hi int) int {
	v := strings.TrimSpace(r.URL.Query().Get(key))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return max(lo, min(hi, n))
}
