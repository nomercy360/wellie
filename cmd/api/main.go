// @title           Wellie API
// @version         1.0
// @description     Wellie application API

// @host      https://api-wellie.mxksimdev.com
// @BasePath  /
// @schemes   http https

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description JWT Authorization header using Bearer scheme. Example: "Authorization: Bearer {token}"

package main

import (
	"context"
	"fmt"
	telegram "github.com/go-telegram/bot"
	"github.com/labstack/echo/v4"
	"gopkg.in/yaml.v3"
	"log"
	"log/slog"
	"net/http"
	"os"
	"wellie/internal/db"
	"wellie/internal/handler"
	"wellie/internal/middleware"
	"wellie/internal/storage"
)

type Config struct {
	Host             string           `yaml:"host"`
	Port             int              `yaml:"port"`
	DBPath           string           `yaml:"db_path"`
	TelegramBotToken string           `yaml:"telegram_bot_token"`
	OpenAIAPIKey     string           `yaml:"openai_api_key"`
	GrokAPIKey       string           `yaml:"grok_api_key"`
	ExternalURL      string           `yaml:"external_url"`
	JWTSecretKey     string           `yaml:"jwt_secret_key"`
	S3Storage        storage.S3Config `yaml:"s3_storage"`
	TelegramWebApp   string           `yaml:"telegram_webapp_url"`
}

func ReadConfig(filePath string) (*Config, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open config file: %w", err)
	}
	defer file.Close()

	var cfg Config
	decoder := yaml.NewDecoder(file)
	if err := decoder.Decode(&cfg); err != nil {
		return nil, fmt.Errorf("failed to decode config file: %w", err)
	}

	return &cfg, nil
}

func ValidateConfig(cfg *Config) error {
	// TODO: Add validation rules for the config fields
	return nil
}

func main() {
	configFilePath := "config.yml"
	configFilePathEnv := os.Getenv("CONFIG_FILE_PATH")
	if configFilePathEnv != "" {
		configFilePath = configFilePathEnv
	}

	cfg, err := ReadConfig(configFilePath)
	if err != nil {
		log.Fatalf("error reading configuration: %v", err)
	}

	if err := ValidateConfig(cfg); err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}

	dbStorage, err := db.ConnectDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	bot, err := telegram.New(cfg.TelegramBotToken)
	if err != nil {
		log.Fatal(err)
	}

	var storageProvider storage.Provider
	storageProvider, err = storage.NewS3Provider(cfg.S3Storage)
	if err != nil {
		log.Printf("Warning: Failed to initialize S3 storage: %v", err)
		storageProvider = nil
	}

	h := handler.New(bot, dbStorage, cfg.JWTSecretKey, cfg.TelegramBotToken, cfg.TelegramWebApp, storageProvider)

	log.Printf("Authorized on account %d", bot.ID())

	e := echo.New()

	logr := slog.New(slog.NewTextHandler(os.Stdout, nil))

	middleware.Setup(e, logr)

	webhookURL := fmt.Sprintf("%s/webhook", cfg.ExternalURL)
	if ok, err := bot.SetWebhook(context.Background(), &telegram.SetWebhookParams{
		DropPendingUpdates: true,
		URL:                webhookURL,
	}); err != nil {
		log.Fatalf("Failed to set webhook: %v", err)
	} else if !ok {
		log.Fatalf("Failed to set webhook: %v", err)
	}

	h.RegisterRoutes(e)

	e.Static("/swagger", "./docs")

	port := "8080"
	log.Printf("Starting server on port %s", port)
	if err := e.Start(":" + port); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
