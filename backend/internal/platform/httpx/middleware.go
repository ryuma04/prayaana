package httpx

import (
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v)
				}
				slog.Error("panic", "path", r.URL.Path, "value", v, "stack", string(debug.Stack()))
				JSON(w, http.StatusInternalServerError, map[string]any{"error": E(500, "internal", "Something went wrong on our side. Please try again.")})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		if r.URL.Path == "/healthz" {
			return
		}
		level := slog.LevelInfo
		if ww.Status() >= 500 {
			level = slog.LevelError
		}
		slog.Log(r.Context(), level, "http", "method", r.Method, "path", r.URL.Path, "status", ww.Status(),
			"ms", time.Since(start).Milliseconds(), "req", middleware.GetReqID(r.Context()))
	})
}

func CORS(origins []string) func(http.Handler) http.Handler {
	allowAll := false
	allowed := map[string]bool{}
	for _, o := range origins {
		if o == "*" {
			allowAll = true
		}
		allowed[strings.ToLower(o)] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			norm := strings.ToLower(strings.TrimRight(origin, "/"))
			isAllowed := allowAll || allowed[norm] || strings.HasSuffix(norm, ".vercel.app") || strings.Contains(norm, "localhost") || strings.Contains(norm, "127.0.0.1")
			if origin != "" && isAllowed {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id")
				h.Set("Access-Control-Max-Age", "600")
				h.Add("Vary", "Origin")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

// RateLimit is a small fixed-window limiter per client IP, for login and public endpoints.
func RateLimit(perMinute int) func(http.Handler) http.Handler {
	type bucket struct {
		start time.Time
		count int
	}
	var mu sync.Mutex
	buckets := map[string]*bucket{}
	go func() {
		for range time.Tick(5 * time.Minute) {
			mu.Lock()
			for k, b := range buckets {
				if time.Since(b.start) > time.Minute {
					delete(buckets, k)
				}
			}
			mu.Unlock()
		}
	}()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			mu.Lock()
			b := buckets[ip]
			if b == nil || time.Since(b.start) > time.Minute {
				b = &bucket{start: time.Now()}
				buckets[ip] = b
			}
			b.count++
			over := b.count > perMinute
			mu.Unlock()
			if over {
				w.Header().Set("Retry-After", "60")
				JSON(w, http.StatusTooManyRequests, map[string]any{"error": E(429, "rate_limited", "Too many requests. Please wait a minute and try again.")})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
