// Simplified timeline functionality for subject pages

(function () {
  "use strict";

  let allCards = [];
  let currentFilter = "all";
  let searchTerm = "";

  document.addEventListener("DOMContentLoaded", function () {
    // Get all class cards
    allCards = Array.from(document.querySelectorAll(".class-card"));

    if (allCards.length === 0) {
      console.warn("No class cards found");
      return;
    }

    // Get DOM elements
    const searchInput = document.getElementById("searchInput");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const customDateRange = document.getElementById("customDateRange");
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const applyDateBtn = document.getElementById("applyDateFilter");
    const noResults = document.getElementById("noResults");
    const filteredClassesCount = document.getElementById("filteredClasses");
    // Filter buttons
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        filterButtons.forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
        currentFilter = this.dataset.filter;

        if (currentFilter === "custom") {
          customDateRange.style.display = "flex";
        } else {
          customDateRange.style.display = "none";
          applyFilter();
        }
      });
    });

    // Search input
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        searchTerm = this.value.toLowerCase();
        applyFilter();
      });
    }

    // Custom date range
    if (applyDateBtn) {
      applyDateBtn.addEventListener("click", function () {
        applyFilter();
      });
    }

    // Apply filter
    function applyFilter() {
      let visibleCount = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      allCards.forEach((card) => {
        const cardDate = new Date(card.dataset.date);
        const cardTitle = card.dataset.title || "";
        const cardTopics = card.dataset.topics || "";
        const cardProfessor = card.dataset.professor || "";

        // Date filter
        let dateMatch = true;
        if (currentFilter === "week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          dateMatch = cardDate >= weekAgo && cardDate <= today;
        } else if (currentFilter === "10days") {
          const tenDaysAgo = new Date(today);
          tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
          dateMatch = cardDate >= tenDaysAgo && cardDate <= today;
        } else if (currentFilter === "30days") {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          dateMatch = cardDate >= thirtyDaysAgo && cardDate <= today;
        } else if (currentFilter === "custom") {
          const startDate = startDateInput
            ? new Date(startDateInput.value)
            : null;
          const endDate = endDateInput ? new Date(endDateInput.value) : null;
          if (startDate && endDate) {
            dateMatch = cardDate >= startDate && cardDate <= endDate;
          }
        }

        // Search filter
        let searchMatch = true;
        if (searchTerm) {
          searchMatch =
            cardTitle.includes(searchTerm) ||
            cardTopics.toLowerCase().includes(searchTerm) ||
            cardProfessor.includes(searchTerm);
        }

        // Show/hide card
        if (dateMatch && searchMatch) {
          card.style.display = "";
          visibleCount++;
        } else {
          card.style.display = "none";
        }
      });

      // Update count
      if (filteredClassesCount) {
        filteredClassesCount.textContent = visibleCount;
      }

      // Show/hide no results
      if (noResults) {
        noResults.style.display = visibleCount === 0 ? "block" : "none";
      }
    }

    // Initial filter
    applyFilter();
  });
})();
