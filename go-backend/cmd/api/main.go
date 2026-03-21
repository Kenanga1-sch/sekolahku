package main

import (
	"database/sql"
	"net/http"
	"path/filepath"

	"github.com/labstack/echo/v4"
	_ "modernc.org/sqlite"

	"github.com/sekolahku/go-backend/internal/handlers"
	"github.com/sekolahku/go-backend/internal/repository"
)

func main() {
	e := echo.New()

	dbPath := filepath.Join("..", "data", "sekolahku.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		e.Logger.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		e.Logger.Fatal("Database ping failed:", err)
	}

	// Repositories
	userRepo := repository.NewUserRepository(db)
	academicRepo := repository.NewAcademicRepository(db)
	financeRepo := repository.NewFinanceRepository(db)
	inventoryRepo := repository.NewInventoryRepository(db)
	spmbRepo := repository.NewSPMBRepository(db)
	studentRepo := repository.NewStudentRepository(db)
	employeeRepo := repository.NewEmployeeRepository(db)

	// Handlers
	authHandler := handlers.NewAuthHandler(userRepo)
	academicHandler := handlers.NewAcademicHandler(academicRepo)
	financeHandler := handlers.NewFinanceHandler(financeRepo)
	inventoryHandler := handlers.NewInventoryHandler(inventoryRepo)
	spmbHandler := handlers.NewSPMBHandler(spmbRepo)
	studentHandler := handlers.NewStudentHandler(studentRepo)
	employeeHandler := handlers.NewEmployeeHandler(employeeRepo)

	// Routes
	e.GET("/api/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "OK"})
	})

	e.POST("/api/auth/login", authHandler.Login)
	e.GET("/api/academic/active-year", academicHandler.GetActiveAcademicYear)
	
	e.GET("/api/finance/accounts", financeHandler.GetAccounts)
	e.POST("/api/finance/accounts", financeHandler.CreateAccount)
	e.PUT("/api/finance/accounts/:id", financeHandler.UpdateAccount)
	e.DELETE("/api/finance/accounts/:id", financeHandler.DeleteAccount)

	e.GET("/api/inventory/rooms", inventoryHandler.GetRooms)
	e.GET("/api/inventory/rooms/:id", inventoryHandler.GetRoom)
	e.POST("/api/inventory/rooms", inventoryHandler.CreateRoom)
	e.PUT("/api/inventory/rooms/:id", inventoryHandler.UpdateRoom)
	e.DELETE("/api/inventory/rooms/:id", inventoryHandler.DeleteRoom)

	e.GET("/api/spmb/periods", spmbHandler.GetPeriods)
	e.POST("/api/spmb/periods", spmbHandler.CreatePeriod)
	e.GET("/api/spmb/active-period", spmbHandler.GetActivePeriod)

	e.GET("/api/students", studentHandler.GetStudents)
	
	e.GET("/api/master/employees", employeeHandler.GetEmployees)
	e.POST("/api/master/employees", employeeHandler.CreateEmployee)

	e.Logger.Fatal(e.Start(":8080"))
}
