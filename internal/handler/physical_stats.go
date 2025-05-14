package handler

import (
	"github.com/labstack/echo/v4"
	"net/http"
	"wellie/internal/contract"
	"wellie/internal/db"
)

// SavePhysicalStats godoc
// @Summary      Save user physical stats
// @Description  Save physical statistics for the authenticated user
// @Tags         physical-stats
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body contract.SavePhysicalStatsRequest true "Physical stats data"
// @Success      200  {object}  contract.SavePhysicalStatsResponse
// @Failure      400  {object}  contract.ErrorResponse "Invalid request"
// @Failure      401  {object}  contract.ErrorResponse "Unauthorized"
// @Failure      500  {object}  contract.ErrorResponse "Server error"
// @Router       /v1/physical-stats [post]
func (h *Handler) SavePhysicalStats(c echo.Context) error {
	userID, err := GetUserIDFromToken(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "failed to get user ID from token").SetInternal(err)
	}

	var req contract.SavePhysicalStatsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "failed to bind request").SetInternal(err)
	}

	if err := req.Validate(); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Convert request to physical stats
	stats := &db.PhysicalStats{
		Weight:            req.Weight,
		Height:            req.Height,
		Gender:            req.Gender,
		BodyFatPercentage: req.BodyFatPercentage,
	}

	// Save to database
	if err := h.db.SaveUserPhysicalStats(userID, stats); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save physical stats").SetInternal(err)
	}

	// Get updated user
	user, err := h.db.GetUserByID(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get user").SetInternal(err)
	}

	return c.JSON(http.StatusOK, contract.SavePhysicalStatsResponse{
		User: *user,
	})
}
