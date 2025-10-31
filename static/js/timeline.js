// Timeline functionality for subject pages

(function() {
    'use strict';

    // Configuration
    const ITEMS_PER_PAGE = 10;

    // State
    let allClasses = [];
    let filteredClasses = [];
    let displayedClasses = [];
    let currentIndex = 0;
    let currentFilter = 'all';

    // DOM Elements
    let timelineContent;
    let loadMoreBtn;
    let loadMoreContainer;
    let noResults;
    let searchInput;
    let filterButtons;
    let customDateRange;
    let startDateInput;
    let endDateInput;
    let applyDateBtn;
    let filteredClassesCount;

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        // Load classes data
        const dataElement = document.getElementById('classesData');
        if (!dataElement) {
            console.error('Classes data not found');
            return;
        }

        try {
            allClasses = JSON.parse(dataElement.textContent);
            filteredClasses = [...allClasses];
        } catch (e) {
            console.error('Failed to parse classes data:', e);
            return;
        }

        // Get DOM elements
        timelineContent = document.getElementById('timelineContent');
        loadMoreBtn = document.getElementById('loadMoreBtn');
        loadMoreContainer = document.getElementById('loadMoreContainer');
        noResults = document.getElementById('noResults');
        searchInput = document.getElementById('searchInput');
        filterButtons = document.querySelectorAll('.filter-btn');
        customDateRange = document.getElementById('customDateRange');
        startDateInput = document.getElementById('startDate');
        endDateInput = document.getElementById('endDate');
        applyDateBtn = document.getElementById('applyDateFilter');
        filteredClassesCount = document.getElementById('filteredClasses');

        // Attach event listeners
        attachEventListeners();

        // Initial render
        renderClasses(true);
    });

    // Attach event listeners
    function attachEventListeners() {
        // Filter buttons
        filterButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                filterButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                const filter = this.dataset.filter;
                currentFilter = filter;

                if (filter === 'custom') {
                    customDateRange.style.display = 'flex';
                } else {
                    customDateRange.style.display = 'none';
                    applyFilter(filter);
                }
            });
        });

        // Apply custom date filter
        if (applyDateBtn) {
            applyDateBtn.addEventListener('click', function() {
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;

                if (startDate && endDate) {
                    applyCustomDateFilter(startDate, endDate);
                } else {
                    alert('Please select both start and end dates');
                }
            });
        }

        // Search input
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                applySearch(this.value);
            });
        }

        // Load more button
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', function() {
                loadMore();
            });
        }
    }

    // Apply filter
    function applyFilter(filter) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch(filter) {
            case 'all':
                filteredClasses = [...allClasses];
                break;

            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                filteredClasses = allClasses.filter(cls => {
                    const classDate = new Date(cls.date);
                    return classDate >= weekAgo && classDate <= today;
                });
                break;

            case '10days':
                const tenDaysAgo = new Date(today);
                tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
                filteredClasses = allClasses.filter(cls => {
                    const classDate = new Date(cls.date);
                    return classDate >= tenDaysAgo && classDate <= today;
                });
                break;

            case '30days':
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                filteredClasses = allClasses.filter(cls => {
                    const classDate = new Date(cls.date);
                    return classDate >= thirtyDaysAgo && classDate <= today;
                });
                break;
        }

        // Re-apply search if active
        const searchTerm = searchInput ? searchInput.value : '';
        if (searchTerm) {
            applySearch(searchTerm);
        } else {
            renderClasses(true);
        }
    }

    // Apply custom date filter
    function applyCustomDateFilter(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        filteredClasses = allClasses.filter(cls => {
            const classDate = new Date(cls.date);
            return classDate >= start && classDate <= end;
        });

        renderClasses(true);
    }

    // Apply search
    function applySearch(searchTerm) {
        searchTerm = searchTerm.toLowerCase().trim();

        if (!searchTerm) {
            // If no search term, just apply current filter
            applyFilter(currentFilter);
            return;
        }

        filteredClasses = filteredClasses.filter(cls => {
            const titleMatch = cls.title.toLowerCase().includes(searchTerm);
            const topicsMatch = cls.topics && cls.topics.some(topic =>
                topic.toLowerCase().includes(searchTerm)
            );
            return titleMatch || topicsMatch;
        });

        renderClasses(true);
    }

    // Render classes
    function renderClasses(reset = false) {
        if (reset) {
            currentIndex = 0;
            displayedClasses = [];
            timelineContent.innerHTML = '';
        }

        if (filteredClasses.length === 0) {
            noResults.style.display = 'block';
            loadMoreContainer.style.display = 'none';
            if (filteredClassesCount) {
                filteredClassesCount.textContent = '0';
            }
            return;
        } else {
            noResults.style.display = 'none';
        }

        // Get next batch
        const nextBatch = filteredClasses.slice(currentIndex, currentIndex + ITEMS_PER_PAGE);
        displayedClasses = displayedClasses.concat(nextBatch);
        currentIndex += nextBatch.length;

        // Group by week
        const grouped = groupByWeek(displayedClasses);

        // Render grouped classes
        renderGroupedClasses(grouped);

        // Update filtered count
        if (filteredClassesCount) {
            filteredClassesCount.textContent = currentIndex;
        }

        // Show/hide load more button
        if (currentIndex < filteredClasses.length) {
            loadMoreContainer.style.display = 'block';
            const remaining = filteredClasses.length - currentIndex;
            document.getElementById('loadMoreCount').textContent =
                `(${remaining} more)`;
        } else {
            loadMoreContainer.style.display = 'none';
        }
    }

    // Load more classes
    function loadMore() {
        const nextBatch = filteredClasses.slice(currentIndex, currentIndex + ITEMS_PER_PAGE);
        displayedClasses = displayedClasses.concat(nextBatch);
        currentIndex += nextBatch.length;

        // Group only the new batch
        const grouped = groupByWeek(nextBatch);

        // Append new classes
        appendGroupedClasses(grouped);

        // Update filtered count
        if (filteredClassesCount) {
            filteredClassesCount.textContent = currentIndex;
        }

        // Check if more to load
        if (currentIndex >= filteredClasses.length) {
            loadMoreContainer.style.display = 'none';
        } else {
            const remaining = filteredClasses.length - currentIndex;
            document.getElementById('loadMoreCount').textContent =
                `(${remaining} more)`;
        }
    }

    // Group classes by week
    function groupByWeek(classes) {
        const groups = {};

        classes.forEach(cls => {
            const date = new Date(cls.date);
            const weekKey = getWeekKey(date);

            if (!groups[weekKey]) {
                groups[weekKey] = {
                    label: getWeekLabel(date),
                    classes: []
                };
            }

            groups[weekKey].classes.push(cls);
        });

        return groups;
    }

    // Get week key
    function getWeekKey(date) {
        const year = date.getFullYear();
        const week = getWeekNumber(date);
        return `${year}-W${week}`;
    }

    // Get week number
    function getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    // Get week label
    function getWeekLabel(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());

        if (weekStart.getTime() === thisWeekStart.getTime()) {
            return 'This Week';
        }

        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(thisWeekStart.getDate() - 7);

        if (weekStart.getTime() === lastWeekStart.getTime()) {
            return 'Last Week';
        }

        const options = { month: 'short', day: 'numeric' };
        return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`;
    }

    // Render grouped classes
    function renderGroupedClasses(grouped) {
        timelineContent.innerHTML = '';

        Object.keys(grouped).forEach(weekKey => {
            const group = grouped[weekKey];

            const weekSection = document.createElement('div');
            weekSection.className = 'week-group';

            const weekHeader = document.createElement('h2');
            weekHeader.className = 'week-header';
            weekHeader.textContent = `📆 ${group.label}`;
            weekSection.appendChild(weekHeader);

            group.classes.forEach(cls => {
                weekSection.appendChild(createClassCard(cls));
            });

            timelineContent.appendChild(weekSection);
        });
    }

    // Append grouped classes
    function appendGroupedClasses(grouped) {
        Object.keys(grouped).forEach(weekKey => {
            const group = grouped[weekKey];

            // Check if week group already exists
            let weekSection = Array.from(timelineContent.children).find(
                el => el.querySelector('.week-header')?.textContent === `📆 ${group.label}`
            );

            if (!weekSection) {
                weekSection = document.createElement('div');
                weekSection.className = 'week-group';

                const weekHeader = document.createElement('h2');
                weekHeader.className = 'week-header';
                weekHeader.textContent = `📆 ${group.label}`;
                weekSection.appendChild(weekHeader);

                timelineContent.appendChild(weekSection);
            }

            group.classes.forEach(cls => {
                weekSection.appendChild(createClassCard(cls));
            });
        });
    }

    // Create class card
    function createClassCard(cls) {
        const card = document.createElement('div');
        card.className = 'class-card';

        const header = document.createElement('div');
        header.className = 'class-card-header';

        const dateInfo = document.createElement('div');
        dateInfo.className = 'class-date-info';

        const date = document.createElement('div');
        date.className = 'class-date';
        date.textContent = cls.dateFormatted;

        const meta = document.createElement('div');
        meta.innerHTML = `
            <span class="class-time">🕐 ${cls.time}</span>
            <span class="class-location">📍 ${cls.location}</span>
        `;

        dateInfo.appendChild(date);
        dateInfo.appendChild(meta);
        header.appendChild(dateInfo);

        const title = document.createElement('h3');
        title.className = 'class-card-title';
        title.innerHTML = `<a href="${cls.url}">${cls.title}</a>`;

        const topics = document.createElement('div');
        topics.className = 'class-topics';
        if (cls.topics) {
            cls.topics.forEach(topic => {
                const tag = document.createElement('span');
                tag.className = 'topic-tag';
                tag.textContent = topic;
                topics.appendChild(tag);
            });
        }

        const mediaInfo = document.createElement('div');
        mediaInfo.className = 'class-media-info';

        const mediaBadges = [];
        if (cls.hasVideos) {
            mediaBadges.push(`<span class="media-badge">📹 ${cls.videoCount} ${cls.videoCount === 1 ? 'Video' : 'Videos'}</span>`);
        }
        if (cls.hasAudio) {
            mediaBadges.push(`<span class="media-badge">🎵 ${cls.audioCount} ${cls.audioCount === 1 ? 'Audio' : 'Audio Files'}</span>`);
        }
        if (cls.hasImages) {
            mediaBadges.push(`<span class="media-badge">📷 ${cls.imageCount} ${cls.imageCount === 1 ? 'Image' : 'Images'}</span>`);
        }
        if (cls.hasDocuments) {
            mediaBadges.push(`<span class="media-badge">📄 ${cls.documentCount} ${cls.documentCount === 1 ? 'Document' : 'Documents'}</span>`);
        }

        mediaInfo.innerHTML = mediaBadges.join('');

        const viewBtn = document.createElement('a');
        viewBtn.href = cls.url;
        viewBtn.className = 'view-details-btn';
        viewBtn.textContent = 'View Details →';

        card.appendChild(header);
        card.appendChild(title);
        card.appendChild(topics);
        if (mediaBadges.length > 0) {
            card.appendChild(mediaInfo);
        }
        card.appendChild(viewBtn);

        return card;
    }

})();
