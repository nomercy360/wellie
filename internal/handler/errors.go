package handler

import (
	"errors"
	"fmt"
)

// Custom error types for better error handling
var (
	ErrAIServiceNotConfigured  = errors.New("AI service is not configured")
	ErrNoPhotoFound            = errors.New("no photo found")
	ErrStorageUploadFailed     = errors.New("storage upload failed")
	ErrDishDetectionFailed     = errors.New("dish detection failed")
	ErrNutritionAnalysisFailed = errors.New("nutrition analysis failed")
)

// ProcessingError wraps errors with additional context
type ProcessingError struct {
	Type    error
	Message string
	Cause   error
}

func (e *ProcessingError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Cause)
	}
	return e.Message
}

func (e *ProcessingError) Unwrap() error {
	return e.Type
}

// Helper function to create processing errors
func newProcessingError(errType error, message string, cause error) error {
	return &ProcessingError{
		Type:    errType,
		Message: message,
		Cause:   cause,
	}
}

// GetUserFriendlyMessage returns a user-friendly error message based on the error type
func GetUserFriendlyMessage(err error) string {
	baseMessage := "❌ Sorry, I couldn't analyze your food image."

	var processingErr *ProcessingError
	if errors.As(err, &processingErr) {
		err = processingErr.Type
	}

	switch {
	case errors.Is(err, ErrAIServiceNotConfigured):
		return baseMessage + " The AI service is temporarily unavailable."
	case errors.Is(err, ErrNoPhotoFound):
		return baseMessage + " Please send a photo."
	case errors.Is(err, ErrStorageUploadFailed):
		return baseMessage + " There was an issue saving your image."
	case errors.Is(err, ErrDishDetectionFailed), errors.Is(err, ErrNutritionAnalysisFailed):
		return baseMessage + " Please try with a clearer photo of the food."
	default:
		return baseMessage + " Please try again later."
	}
}
