const form = document.getElementById("search-form");

if (form) {
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const city = document.getElementById("search-input").value.trim();
        if (!city) return;

        console.log(`Searching for ${city}`);
        fetchWeatherForCity(city);
    });
}

const METEOCONS_BASE_URL = "https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg";
const DEFAULT_HERO_IMAGE_URL = "https://cdn.mos.cms.futurecdn.net/zWy2ezQgTQkBW8hz9sbedH.jpg";
const LOADING_EMOJIS = ["☀️", "⛅", "🌧️", "❄️"];
let loadingIntervalId = null;
let heroImageRequestId = 0;

const hourlyForecastState = {
    today: [],
    tomorrow: [],
    activeTab: "today"
};

const MAP_LAYERS = [
    { label: "Stradale", type: "m" },
    { label: "Satellite", type: "k" },
    { label: "Ibrida", type: "h" },
    { label: "Terreno", type: "p" }
];

const mapState = {
    latitude: null,
    longitude: null,
    cityName: "",
    layerIndex: 0
};

function getFormattedItalianDate(date = new Date()) {
    const formatted = date.toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long"
    });

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getDayCardLabels(dateStr, index) {
    const date = new Date(`${dateStr}T12:00:00`);
    const shortDate = date.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "short"
    });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    let dayName;
    if (dateStr === todayStr) {
        dayName = "Oggi";
    } else if (dateStr === tomorrowStr) {
        dayName = "Domani";
    } else {
        const weekday = date.toLocaleDateString("it-IT", { weekday: "short" });
        dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace(".", "");
    }

    return {
        dayName,
        shortDate,
        isToday: dateStr === todayStr
    };
}

function getMeteoconName(weatherCode, isDay = true) {
    if (weatherCode === 0) return isDay ? "clear-day" : "clear-night";
    if (weatherCode === 1 || weatherCode === 2) return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
    if (weatherCode === 3) return "overcast";
    if (weatherCode === 45 || weatherCode === 48) return isDay ? "fog-day" : "fog-night";
    if ([51, 53, 55, 56, 57].includes(weatherCode)) return "drizzle";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return "rain";
    if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return "snow";
    if ([95, 96, 99].includes(weatherCode)) return "thunderstorms";

    return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
}

function getMeteoconUrl(weatherCode, isDay = true) {
    const iconName = getMeteoconName(weatherCode, isDay);
    return `${METEOCONS_BASE_URL}/${iconName}.svg`;
}

function getWeatherEmoji(weatherCode, isDay = true) {
    if (weatherCode === 0) return isDay ? "☀️" : "🌙";
    if (weatherCode === 1 || weatherCode === 2) return isDay ? "⛅" : "☁️";
    if (weatherCode === 3) return "☁️";
    if (weatherCode === 45 || weatherCode === 48) return "🌫️";
    if ([51, 53, 55, 56, 57].includes(weatherCode)) return "🌦️";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return "🌧️";
    if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return "❄️";
    if ([95, 96, 99].includes(weatherCode)) return "⛈️";

    return isDay ? "⛅" : "☁️";
}

function startLoadingAnimation(cityName = "Roma") {
    stopLoadingAnimation();

    const cityEl = document.getElementById("current-city");
    const locationEl = document.getElementById("location-name");
    const dateEl = document.getElementById("location-date");
    const tempEl = document.getElementById("current-temp");
    const descEl = document.getElementById("current-desc");
    const emojiEl = document.getElementById("current-emoji");
    const iconEl = document.getElementById("current-icon");
    const detailsEl = document.getElementById("weather-details");

    if (cityEl) cityEl.textContent = cityName;
    if (locationEl) locationEl.textContent = `Previsione: ${cityName} |`;
    if (dateEl) dateEl.textContent = getFormattedItalianDate();
    if (tempEl) tempEl.textContent = "--°C";
    if (descEl) descEl.textContent = "Caricamento...";
    if (detailsEl) detailsEl.textContent = "";

    if (iconEl) {
        iconEl.hidden = true;
        iconEl.removeAttribute("src");
    }

    let index = 0;
    if (emojiEl) {
        emojiEl.hidden = false;
        emojiEl.textContent = LOADING_EMOJIS[0];
    }

    loadingIntervalId = setInterval(() => {
        index = (index + 1) % LOADING_EMOJIS.length;
        if (emojiEl) {
            emojiEl.textContent = LOADING_EMOJIS[index];
        }
    }, 450);

    hourlyForecastState.today = [];
    hourlyForecastState.tomorrow = [];
    renderHourlyStatus("Caricamento previsioni orarie...");
    renderTenDayStatus("Caricamento previsioni 10 giorni...");
}

function stopLoadingAnimation() {
    if (loadingIntervalId !== null) {
        clearInterval(loadingIntervalId);
        loadingIntervalId = null;
    }
}

function showUnavailableState(message = "Dati non disponibili") {
    stopLoadingAnimation();

    const tempEl = document.getElementById("current-temp");
    const descEl = document.getElementById("current-desc");
    const emojiEl = document.getElementById("current-emoji");
    const iconEl = document.getElementById("current-icon");
    const detailsEl = document.getElementById("weather-details");

    if (tempEl) tempEl.textContent = "--°C";
    if (descEl) descEl.textContent = message;
    if (detailsEl) detailsEl.textContent = "";

    if (iconEl) {
        iconEl.hidden = true;
        iconEl.removeAttribute("src");
    }

    if (emojiEl) {
        emojiEl.hidden = false;
        emojiEl.textContent = "⏳";
    }

    hourlyForecastState.today = [];
    hourlyForecastState.tomorrow = [];
    renderHourlyStatus(message);
    renderTenDayStatus(message);
}

function updateDashboard(data, useMeteoconSvg = false) {
    stopLoadingAnimation();

    const cityEl = document.getElementById("current-city");
    const locationEl = document.getElementById("location-name");
    const dateEl = document.getElementById("location-date");
    const tempEl = document.getElementById("current-temp");
    const descEl = document.getElementById("current-desc");
    const emojiEl = document.getElementById("current-emoji");
    const iconEl = document.getElementById("current-icon");
    const detailsEl = document.getElementById("weather-details");

    if (cityEl) cityEl.textContent = data.city;
    if (locationEl) locationEl.textContent = `Previsione: ${data.city} |`;
    if (dateEl) dateEl.textContent = getFormattedItalianDate();
    if (tempEl) tempEl.textContent = `${Math.round(data.temp)}°C`;
    if (descEl) descEl.textContent = data.description;

    if (useMeteoconSvg) {
        if (emojiEl) emojiEl.hidden = true;
        if (iconEl) {
            iconEl.hidden = false;
            iconEl.src = getMeteoconUrl(data.weatherCode, data.isDay);
            iconEl.alt = data.description;
        }
    } else {
        if (iconEl) {
            iconEl.hidden = true;
            iconEl.removeAttribute("src");
        }
        if (emojiEl) {
            emojiEl.hidden = false;
            emojiEl.textContent = getWeatherEmoji(data.weatherCode, data.isDay);
        }
    }

    if (detailsEl) {
        detailsEl.innerHTML = `
            <span>Percepita: ${Math.round(data.feelsLike)}°C</span>
            <span>Vento: ${data.wind} km/h</span>
            <span>Umidità: ${data.humidity}%</span>
            <span>AQI: ${data.aqi}</span>
        `;
    }

    const mapEmojiEl = document.getElementById("map-emoji");
    const mapIconEl = document.getElementById("map-icon");
    const mapTempEl = document.getElementById("map-temp");
    const mapDescEl = document.getElementById("map-desc");
    const mapFeelsLikeEl = document.getElementById("map-feels-like");

    if (useMeteoconSvg) {
        if (mapEmojiEl) mapEmojiEl.hidden = true;
        if (mapIconEl) {
            mapIconEl.hidden = false;
            mapIconEl.src = getMeteoconUrl(data.weatherCode, data.isDay);
            mapIconEl.alt = data.description;
        }
    } else {
        if (mapIconEl) {
            mapIconEl.hidden = true;
            mapIconEl.removeAttribute("src");
        }
        if (mapEmojiEl) {
            mapEmojiEl.hidden = false;
            mapEmojiEl.textContent = getWeatherEmoji(data.weatherCode, data.isDay);
        }
    }

    if (mapTempEl) mapTempEl.textContent = `${Math.round(data.temp)}°C`;
    if (mapDescEl) mapDescEl.textContent = `${data.city} · ${data.description}`;
    if (mapFeelsLikeEl) mapFeelsLikeEl.textContent = `Percepita: ${Math.round(data.feelsLike)}°C`;
}




function renderHourlyStatus(message) {
    const hourlyItemsEl = document.getElementById("hourly-items");
    const chartEl = document.getElementById("temperature-chart");

    if (hourlyItemsEl) {
        hourlyItemsEl.innerHTML = "";
        const statusEl = document.createElement("p");
        statusEl.className = "hourly-status";
        statusEl.textContent = message;
        hourlyItemsEl.appendChild(statusEl);
    }

    if (chartEl) {
        chartEl.innerHTML = "";
    }
}

function buildHourlyForecastByDay(hourly, currentTimeStr = "", stepHours = 3) {
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
        return { today: [], tomorrow: [] };
    }

    const datesOrder = [];
    const groupedByDate = new Map();
    const currentDateKey = currentTimeStr ? currentTimeStr.slice(0, 10) : "";
    const currentHour = currentTimeStr ? parseInt(currentTimeStr.slice(11, 13), 10) : -1;

    for (let i = 0; i < hourly.time.length; i++) {
        const timeStr = hourly.time[i];
        const dateKey = timeStr.slice(0, 10);
        const hourNum = parseInt(timeStr.slice(11, 13), 10);

        if (!groupedByDate.has(dateKey)) {
            groupedByDate.set(dateKey, []);
            datesOrder.push(dateKey);
        }

        if (hourNum % stepHours !== 0) continue;

        const temp = hourly.temperature_2m?.[i];
        if (typeof temp !== "number") continue;

        const rainChance = hourly.precipitation_probability?.[i];
        const weatherCode = hourly.weather_code?.[i];
        const isDayRaw = hourly.is_day?.[i];
        const isDay = typeof isDayRaw === "number" ? isDayRaw === 1 : hourNum >= 6 && hourNum < 20;
        const isCurrent =
            dateKey === currentDateKey &&
            currentHour >= hourNum &&
            currentHour < hourNum + stepHours;

        groupedByDate.get(dateKey).push({
            time: timeStr.slice(11, 16),
            temp: Math.round(temp),
            rainChance: typeof rainChance === "number" ? Math.round(rainChance) : null,
            weatherCode: typeof weatherCode === "number" ? weatherCode : null,
            isDay,
            isCurrent
        });
    }

    const todayKey = currentDateKey && groupedByDate.has(currentDateKey) ? currentDateKey : datesOrder[0];
    const todayIndex = datesOrder.indexOf(todayKey);
    const tomorrowKey = todayIndex >= 0 ? datesOrder[todayIndex + 1] : datesOrder[1];

    return {
        today: todayKey ? groupedByDate.get(todayKey) || [] : [],
        tomorrow: tomorrowKey ? groupedByDate.get(tomorrowKey) || [] : []
    };
}

function renderTemperatureChart(slots) {
    const chartEl = document.getElementById("temperature-chart");
    if (!chartEl) return;

    if (!Array.isArray(slots) || slots.length < 2) {
        chartEl.innerHTML = "";
        return;
    }

    const width = 640;
    const height = 110;
    const padX = 36;
    const padTop = 26;
    const padBottom = 24;
    const plotWidth = width - padX * 2;
    const plotHeight = height - padTop - padBottom;

    const temps = slots.map((s) => s.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const range = maxTemp - minTemp || 2;

    const points = slots.map((slot, i) => {
        const x = padX + (i / (slots.length - 1)) * plotWidth;
        const normalized = maxTemp === minTemp ? 0.5 : (slot.temp - minTemp) / range;
        const y = padTop + (1 - normalized) * plotHeight;
        return { x, y, slot };
    });

    let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const midX = ((curr.x + next.x) / 2).toFixed(1);
        linePath += ` C ${midX} ${curr.y.toFixed(1)}, ${midX} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }

    const baseY = height - padBottom + 6;
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseY} L ${points[0].x.toFixed(1)} ${baseY} Z`;

    const dotsAndLabels = points
        .map(({ x, y, slot }) => {
            const dotColor = slot.isCurrent ? "#f9c74f" : "#00b4d8";
            const dotRadius = slot.isCurrent ? 5 : 3.8;
            return `
                <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotRadius}" fill="${dotColor}" stroke="#14181c" stroke-width="2"></circle>
                <text x="${x.toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="600">${slot.temp}°</text>
                <text x="${x.toFixed(1)}" y="${(height - 5).toFixed(1)}" text-anchor="middle" fill="#94a3b8" font-size="10">${slot.time}</text>
            `;
        })
        .join("");

    chartEl.innerHTML = `
        <svg class="temperature-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Andamento temperatura oraria">
            <defs>
                <linearGradient id="tempAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#00b4d8" stop-opacity="0.35"></stop>
                    <stop offset="100%" stop-color="#00b4d8" stop-opacity="0.02"></stop>
                </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#tempAreaGradient)"></path>
            <path d="${linePath}" fill="none" stroke="#00b4d8" stroke-width="2.5" stroke-linecap="round"></path>
            ${dotsAndLabels}
        </svg>
    `;
}

function renderActiveHourlyTab() {
    const hourlyItemsEl = document.getElementById("hourly-items");
    if (!hourlyItemsEl) return;

    const slots = hourlyForecastState[hourlyForecastState.activeTab] || [];
    if (slots.length === 0) {
        renderHourlyStatus("Previsioni orarie non disponibili");
        return;
    }

    hourlyItemsEl.innerHTML = "";
    const fragment = document.createDocumentFragment();

    slots.forEach((slot) => {
        const emoji = slot.weatherCode !== null ? getWeatherEmoji(slot.weatherCode, slot.isDay) : "🌡️";
        const card = document.createElement("article");
        card.className = slot.isCurrent ? "hourly-card is-current" : "hourly-card";
        card.innerHTML = `
            <span class="hourly-time">${slot.time}</span>
            <span class="hourly-emoji" aria-hidden="true">${emoji}</span>
            <span class="hourly-temp">${slot.temp}°</span>
            <span class="hourly-rain">${slot.rainChance !== null ? `💧 ${slot.rainChance}%` : "--"}</span>
        `;
        fragment.appendChild(card);
    });

    hourlyItemsEl.appendChild(fragment);
    hourlyItemsEl.scrollLeft = 0;
    renderTemperatureChart(slots);
}

function setActiveHourlyTab(tabKey) {
    if (tabKey !== "today" && tabKey !== "tomorrow") return;
    hourlyForecastState.activeTab = tabKey;

    const todayBtn = document.getElementById("tab-today");
    const tomorrowBtn = document.getElementById("tab-tomorrow");

    if (todayBtn) {
        const isToday = tabKey === "today";
        todayBtn.classList.toggle("active", isToday);
        todayBtn.setAttribute("aria-pressed", String(isToday));
    }

    if (tomorrowBtn) {
        const isTomorrow = tabKey === "tomorrow";
        tomorrowBtn.classList.toggle("active", isTomorrow);
        tomorrowBtn.setAttribute("aria-pressed", String(isTomorrow));
    }

    if (hourlyForecastState[tabKey].length > 0) {
        renderActiveHourlyTab();
    }
}

function setupHourlyTabs() {
    const todayBtn = document.getElementById("tab-today");
    const tomorrowBtn = document.getElementById("tab-tomorrow");

    if (todayBtn) {
        todayBtn.setAttribute("aria-pressed", "true");
        todayBtn.addEventListener("click", () => setActiveHourlyTab("today"));
    }

    if (tomorrowBtn) {
        tomorrowBtn.setAttribute("aria-pressed", "false");
        tomorrowBtn.addEventListener("click", () => setActiveHourlyTab("tomorrow"));
    }
}

setupHourlyTabs();

function renderTenDayStatus(message) {
    const daysListEl = document.getElementById("days-list");
    if (!daysListEl) return;

    daysListEl.innerHTML = "";
    const statusEl = document.createElement("p");
    statusEl.className = "days-status";
    statusEl.textContent = message;
    daysListEl.appendChild(statusEl);
    updateTenDayNavButtons();
}

function buildDailyForecastFromHourly(hourly, maxDays = 10) {
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
        return [];
    }

    const groupedByDate = new Map();

    for (let i = 0; i < hourly.time.length; i++) {
        const timeStr = hourly.time[i];
        const dateKey = timeStr.slice(0, 10);

        if (!groupedByDate.has(dateKey)) {
            groupedByDate.set(dateKey, {
                date: dateKey,
                temps: [],
                humidities: [],
                winds: [],
                weatherCodes: [],
                middayWeatherCode: null
            });
        }

        const bucket = groupedByDate.get(dateKey);
        const temp = hourly.temperature_2m?.[i];
        const humidity = hourly.relative_humidity_2m?.[i];
        const wind = hourly.wind_speed_10m?.[i];
        const code = hourly.weather_code?.[i];

        if (typeof temp === "number") bucket.temps.push(temp);
        if (typeof humidity === "number") bucket.humidities.push(humidity);
        if (typeof wind === "number") bucket.winds.push(wind);
        if (typeof code === "number") {
            bucket.weatherCodes.push(code);
            if (timeStr.endsWith("T12:00")) {
                bucket.middayWeatherCode = code;
            }
        }
    }

    const dailySummaries = [];
    for (const bucket of groupedByDate.values()) {
        if (bucket.temps.length === 0) continue;

        const tempMin = Math.min(...bucket.temps);
        const tempMax = Math.max(...bucket.temps);
        const avgHumidity = bucket.humidities.length
            ? Math.round(bucket.humidities.reduce((sum, val) => sum + val, 0) / bucket.humidities.length)
            : null;
        const avgWind = bucket.winds.length
            ? Math.round(bucket.winds.reduce((sum, val) => sum + val, 0) / bucket.winds.length)
            : null;

        let weatherCode = bucket.middayWeatherCode;
        if (weatherCode === null && bucket.weatherCodes.length > 0) {
            weatherCode = bucket.weatherCodes[Math.floor(bucket.weatherCodes.length / 2)];
        }

        dailySummaries.push({
            date: bucket.date,
            tempMin: Math.round(tempMin),
            tempMax: Math.round(tempMax),
            humidity: avgHumidity,
            wind: avgWind,
            weatherCode
        });
    }

    return dailySummaries.slice(0, maxDays);
}

function renderTenDayForecast(days) {
    const daysListEl = document.getElementById("days-list");
    if (!daysListEl) return;

    if (!Array.isArray(days) || days.length === 0) {
        renderTenDayStatus("Previsioni 10 giorni non disponibili");
        return;
    }

    daysListEl.innerHTML = "";
    const fragment = document.createDocumentFragment();

    days.forEach((day, index) => {
        const { dayName, shortDate, isToday } = getDayCardLabels(day.date, index);
        const hasWeatherCode = typeof day.weatherCode === "number";
        const emoji = hasWeatherCode ? getWeatherEmoji(day.weatherCode, true) : "🌡️";
        const description = hasWeatherCode ? getItalianWeatherDescription(day.weatherCode) : "";

        const card = document.createElement("article");
        card.className = isToday ? "day-card is-today" : "day-card";
        card.innerHTML = `
            <header class="day-card-header">
                <span class="day-name">${dayName}</span>
                <span class="day-date">${shortDate}</span>
            </header>
            <span class="day-emoji" aria-hidden="true">${emoji}</span>
            <div class="day-temps">
                <span class="day-temp-max">${day.tempMax}°</span>
                <span class="day-temp-min">${day.tempMin}°</span>
            </div>
            ${description ? `<p class="day-desc">${description}</p>` : ""}
            <div class="day-meta">
                <span>Umidità: ${day.humidity !== null ? `${day.humidity}%` : "N/D"}</span>
                <span>Vento: ${day.wind !== null ? `${day.wind} km/h` : "N/D"}</span>
            </div>
        `;

        fragment.appendChild(card);
    });

    daysListEl.appendChild(fragment);
    daysListEl.scrollLeft = 0;
    updateTenDayNavButtons();
}

function updateTenDayNavButtons() {
    const daysListEl = document.getElementById("days-list");
    const prevBtn = document.getElementById("days-prev");
    const nextBtn = document.getElementById("days-next");
    if (!daysListEl || !prevBtn || !nextBtn) return;

    const maxScrollLeft = daysListEl.scrollWidth - daysListEl.clientWidth;
    prevBtn.disabled = daysListEl.scrollLeft <= 1;
    nextBtn.disabled = maxScrollLeft <= 1 || daysListEl.scrollLeft >= maxScrollLeft - 1;
}

function setupTenDayCarousel() {
    const daysListEl = document.getElementById("days-list");
    const prevBtn = document.getElementById("days-prev");
    const nextBtn = document.getElementById("days-next");
    if (!daysListEl || !prevBtn || !nextBtn) return;

    const getScrollStep = () => {
        const card = daysListEl.querySelector(".day-card");
        return card ? card.offsetWidth * 2 : 296;
    };

    prevBtn.addEventListener("click", () => {
        daysListEl.scrollBy({ left: -getScrollStep(), behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
        daysListEl.scrollBy({ left: getScrollStep(), behavior: "smooth" });
    });

    daysListEl.addEventListener("scroll", updateTenDayNavButtons, { passive: true });
    window.addEventListener("resize", updateTenDayNavButtons);
}

setupTenDayCarousel();

function isValidCityHeroImage(url, width = 0, height = 0) {
    if (!url || typeof url !== "string" || !url.startsWith("https://")) {
        return false;
    }

    const lowerUrl = url.toLowerCase();
    const blockedExtensions = [".svg", ".gif", ".tif", ".tiff", ".pdf", ".ogv", ".webm"];
    if (blockedExtensions.some((ext) => lowerUrl.includes(ext))) {
        return false;
    }

    const blockedKeywords = [
        "stemma",
        "gonfalone",
        "coat_of_arms",
        "coat-of-arms",
        "flag_of",
        "bandiera",
        "locator",
        "location_map",
        "_map",
        "mappa",
        "logo",
        "icon",
        "diagram",
        "chart",
        "signature"
    ];
    if (blockedKeywords.some((keyword) => lowerUrl.includes(keyword))) {
        return false;
    }

    if (width && height) {
        if (width < 600 || width < height) {
            return false;
        }
    }

    return true;
}

async function fetchCityImageUrl(cityName, regionName = "") {
    // 1. Try Italian Wikipedia lead image for the city
    try {
        const wikiUrl = `https://it.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(cityName)}&prop=pageimages&piprop=thumbnail&pithumbsize=1600`;
        const wikiRes = await fetch(wikiUrl);
        if (wikiRes.ok) {
            const wikiJson = await wikiRes.json();
            const pages = Object.values(wikiJson?.query?.pages || {});
            for (const page of pages) {
                const thumb = page?.thumbnail;
                if (thumb && isValidCityHeroImage(thumb.source, thumb.width, thumb.height)) {
                    return thumb.source;
                }
            }
        }
    } catch (error) {
        console.warn("Wikipedia city image fetch failed:", error);
    }

    // 2. Fallback: search Wikimedia Commons for a landscape photo of the city
    const queries = [
        `${cityName} ${regionName} panorama`.trim(),
        `${cityName} Italia`.trim()
    ];

    for (const query of queries) {
        try {
            const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1600`;
            const commonsRes = await fetch(commonsUrl);
            if (!commonsRes.ok) continue;

            const commonsJson = await commonsRes.json();
            const pages = Object.values(commonsJson?.query?.pages || {});
            let fallbackMatch = null;

            for (const page of pages) {
                const info = page?.imageinfo?.[0];
                if (!info) continue;

                const mime = (info.mime || "").toLowerCase();
                if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) continue;

                const candidateUrl = info.thumburl || info.url;
                const width = info.thumbwidth || info.width || 0;
                const height = info.thumbheight || info.height || 0;

                if (!isValidCityHeroImage(candidateUrl, width, height)) continue;

                if (width / height >= 1.25) {
                    return candidateUrl;
                }

                if (!fallbackMatch) {
                    fallbackMatch = candidateUrl;
                }
            }

            if (fallbackMatch) {
                return fallbackMatch;
            }
        } catch (error) {
            console.warn("Wikimedia Commons city image fetch failed:", error);
        }
    }

    return DEFAULT_HERO_IMAGE_URL;
}

function applyHeroBackgroundImage(imageUrl) {
    const heroSection = document.querySelector(".hero-section");
    if (!heroSection) return;

    const safeUrl = imageUrl.replace(/["\\\n\r]/g, "");
    heroSection.style.setProperty("--hero-bg-image", `url("${safeUrl}")`);
}

async function updateHeroBackground(cityName, regionName = "") {
    const requestId = ++heroImageRequestId;
    const imageUrl = await fetchCityImageUrl(cityName, regionName);

    if (requestId !== heroImageRequestId) return;

    const preloader = new Image();
    preloader.onload = () => {
        if (requestId === heroImageRequestId) {
            applyHeroBackgroundImage(imageUrl);
        }
    };
    preloader.onerror = () => {
        if (requestId === heroImageRequestId) {
            applyHeroBackgroundImage(DEFAULT_HERO_IMAGE_URL);
        }
    };
    preloader.src = imageUrl;
}

function renderGoogleMap() {
    const mapContainer = document.getElementById("weather-map");
    const layerNameEl = document.getElementById("radar-layer-name");
    const layer = MAP_LAYERS[mapState.layerIndex] || MAP_LAYERS[0];

    if (layerNameEl) {
        layerNameEl.textContent = layer.label;
    }

    if (!mapContainer || mapState.latitude === null || mapState.longitude === null) {
        return;
    }

    const mapSrc = `https://maps.google.com/maps?q=${mapState.latitude},${mapState.longitude}&hl=it&z=12&t=${layer.type}&output=embed`;
    let iframe = mapContainer.querySelector("iframe.google-map-frame");

    if (!iframe) {
        mapContainer.innerHTML = "";
        iframe = document.createElement("iframe");
        iframe.className = "google-map-frame";
        iframe.loading = "lazy";
        iframe.referrerPolicy = "no-referrer-when-downgrade";
        iframe.allowFullscreen = true;
        mapContainer.appendChild(iframe);
    }

    iframe.title = `Mappa Google di ${mapState.cityName}`;
    iframe.src = mapSrc;
}

function updateGoogleMap(latitude, longitude, cityName) {
    mapState.latitude = latitude;
    mapState.longitude = longitude;
    mapState.cityName = cityName;
    renderGoogleMap();
}

function setupMapControls() {
    const prevBtn = document.getElementById("radar-prev");
    const nextBtn = document.getElementById("radar-next");
    const layerNameEl = document.getElementById("radar-layer-name");

    if (layerNameEl) {
        layerNameEl.textContent = MAP_LAYERS[mapState.layerIndex].label;
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            mapState.layerIndex = (mapState.layerIndex - 1 + MAP_LAYERS.length) % MAP_LAYERS.length;
            renderGoogleMap();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            mapState.layerIndex = (mapState.layerIndex + 1) % MAP_LAYERS.length;
            renderGoogleMap();
        });
    }
}

setupMapControls();

async function fetchWeatherForCity(cityName) {
    startLoadingAnimation(cityName);

    try {
        // 1. Convert city/area name to coordinates
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&countryCode=IT&language=it&format=json`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) throw new Error("Geocoding failed");
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            showUnavailableState("Località non trovata");
            return;
        }

        const place = geoData.results[0];
        const { latitude, longitude, name, admin1 } = place;
        console.log("Matched place:", place.name, place.country, latitude, longitude);
        const formattedCity = admin1 ? `${name}, ${admin1}` : name;

        // Update hero background image and Google Map pin for the searched city
        updateHeroBackground(name, admin1 || "");
        updateGoogleMap(latitude, longitude, formattedCity);

        // 2. Fetch current weather, air quality, hourly (Oggi/Domani), and 10-day forecast in parallel
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&timezone=auto`;
        const aqiUrl = `https://api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi&timezone=auto`;
        const hourlyForecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&forecast_days=2&hourly=temperature_2m,precipitation_probability,weather_code,is_day,wind_speed_10m&timezone=auto`;
        const weatherUrl10Days = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&forecast_days=10&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;

        const [weatherRes, aqiRes, hourlyRes, tenDaysRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl),
            fetch(hourlyForecastUrl),
            fetch(weatherUrl10Days)
        ]);
        if (!weatherRes.ok) throw new Error("Weather fetch failed");

        const weatherJson = await weatherRes.json();
        const current = weatherJson.current;

        let aqiValue = "N/D";
        if (aqiRes.ok) {
            const aqiJson = await aqiRes.json();
            if (aqiJson.current && typeof aqiJson.current.european_aqi === "number") {
                aqiValue = Math.round(aqiJson.current.european_aqi);
            }
        }

        const description = getItalianWeatherDescription(current.weather_code);

        updateDashboard({
            city: formattedCity,
            temp: current.temperature_2m,
            feelsLike: current.apparent_temperature,
            humidity: current.relative_humidity_2m,
            wind: Math.round(current.wind_speed_10m),
            aqi: aqiValue,
            weatherCode: current.weather_code,
            isDay: current.is_day === 1,
            description
        }, false);

        if (hourlyRes.ok) {
            const hourlyJson = await hourlyRes.json();
            const parsedHourly = buildHourlyForecastByDay(hourlyJson.hourly, current.time, 3);
            hourlyForecastState.today = parsedHourly.today;
            hourlyForecastState.tomorrow = parsedHourly.tomorrow;
            renderActiveHourlyTab();
        } else {
            hourlyForecastState.today = [];
            hourlyForecastState.tomorrow = [];
            renderHourlyStatus("Previsioni orarie non disponibili");
        }

        if (tenDaysRes.ok) {
            const tenDaysJson = await tenDaysRes.json();
            const dailyForecast = buildDailyForecastFromHourly(tenDaysJson.hourly, 10);
            renderTenDayForecast(dailyForecast);
        } else {
            renderTenDayStatus("Previsioni 10 giorni non disponibili");
        }
    } catch (error) {
        console.error(error);
        showUnavailableState("Errore di rete");
    }
}

function getItalianWeatherDescription(code) {
    if (code === 0) return "Sereno";
    if (code === 1) return "Prevalentemente sereno";
    if (code === 2) return "Parzialmente nuvoloso";
    if (code === 3) return "Coperto";
    if (code === 45 || code === 48) return "Nebbia";
    if ([51, 53, 55, 56, 57].includes(code)) return "Pioviggine";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Pioggia";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "Neve";
    if ([95, 96, 99].includes(code)) return "Temporale";
    return "Variabile";
}

// Load initial weather when opening the page
fetchWeatherForCity("Roma");