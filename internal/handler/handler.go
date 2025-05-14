package handler

import (
	telegram "github.com/go-telegram/bot"
	"github.com/golang-jwt/jwt/v5"
	echojwt "github.com/labstack/echo-jwt/v4"
	"github.com/labstack/echo/v4"
	"net/http"
	"wellie/internal/contract"
	"wellie/internal/db"
	"wellie/internal/middleware"
	"wellie/internal/storage"
)

type Handler struct {
	bot             *telegram.Bot
	db              *db.Storage
	jwtSecret       string
	botToken        string
	webAppURL       string
	storageProvider storage.Provider
}

func New(
	bot *telegram.Bot,
	db *db.Storage,
	jwtSecret string,
	botToken string,
	webAppURL string,
	storageProvider storage.Provider,
) *Handler {
	return &Handler{
		bot:             bot,
		db:              db,
		jwtSecret:       jwtSecret,
		botToken:        botToken,
		webAppURL:       webAppURL,
		storageProvider: storageProvider,
	}
}

func (h *Handler) RegisterRoutes(e *echo.Echo) {

	e.POST("/webhook", h.HandleWebhook)
	e.POST("/auth/telegram", h.TelegramAuth)

	v1 := e.Group("/v1")

	v1.Use(echojwt.WithConfig(middleware.GetUserAuthConfig(h.jwtSecret)))

	// User endpoints
	v1.GET("/me", h.GetMe)

	// Physical stats endpoints
	v1.POST("/physical-stats", h.SavePhysicalStats)
}

func GetUserIDFromToken(c echo.Context) (string, error) {
	user, ok := c.Get("user").(*jwt.Token)
	if !ok || user == nil {
		return "", echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	claims, ok := user.Claims.(*contract.JWTClaims)
	if !ok || claims == nil {
		return "", echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	return claims.UID, nil
}
