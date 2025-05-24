package handler

import (
	telegram "github.com/go-telegram/bot"
	"github.com/golang-jwt/jwt/v5"
	echojwt "github.com/labstack/echo-jwt/v4"
	"github.com/labstack/echo/v4"
	"net/http"
	"wellie/internal/ai"
	"wellie/internal/contract"
	"wellie/internal/db"
	"wellie/internal/middleware"
	"wellie/internal/storage"
)

type Config struct {
	JWTSecret    string
	BotToken     string
	WebAppURL    string
	OpenAIAPIKey string
}

type Handler struct {
	bot             *telegram.Bot
	db              *db.Storage
	config          Config
	storageProvider storage.Provider
	aiService       *ai.Service
}

func New(
	bot *telegram.Bot,
	db *db.Storage,
	config Config,
	storageProvider storage.Provider,
) *Handler {
	var aiService *ai.Service
	if config.OpenAIAPIKey != "" {
		aiService = ai.NewService(config.OpenAIAPIKey)
	}

	return &Handler{
		bot:             bot,
		db:              db,
		config:          config,
		storageProvider: storageProvider,
		aiService:       aiService,
	}
}

func (h *Handler) RegisterRoutes(e *echo.Echo) {

	e.POST("/webhook", h.HandleWebhook)
	e.POST("/auth/telegram", h.TelegramAuth)

	v1 := e.Group("/v1")

	v1.Use(echojwt.WithConfig(middleware.GetUserAuthConfig(h.config.JWTSecret)))

	// User endpoints
	v1.GET("/me", h.GetMe)

	// Physical stats endpoints
	v1.POST("/physical-stats", h.SavePhysicalStats)

	// Food endpoints
	v1.GET("/food-logs", h.GetUserFoodLogs)
	v1.GET("/food/:id", h.GetFoodDetail)
	v1.POST("/food/recognize", h.RecognizeFood)
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
