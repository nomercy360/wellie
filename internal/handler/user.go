package handler

import (
	"github.com/labstack/echo/v4"
	"net/http"
	_ "wellie/internal/contract"
	_ "wellie/internal/db"
)

// GetMe godoc
// @Summary      Get current user
// @Description  Retrieves the current user based on the JWT token
// @Tags         user
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  db.User
// @Failure      401  {object}  contract.ErrorResponse "Unauthorized"
// @Failure      500  {object}  contract.ErrorResponse "Server error"
// @Router       /v1/me [get]
func (h *Handler) GetMe(c echo.Context) error {
	userID, err := GetUserIDFromToken(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "failed to get user ID from token").SetInternal(err)
	}

	// Retrieve user from database
	user, err := h.db.GetUserByID(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get user").SetInternal(err)
	}

	return c.JSON(http.StatusOK, user)
}
