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
const LOADING_EMOJIS = ["☀️", "⛅", "🌧️", "❄️"];
let loadingIntervalId = null;

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
}




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

        // 2. Fetch current weather, air quality, and 10-day forecast in parallel
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&timezone=auto`;
        const aqiUrl = `https://api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi&timezone=auto`;
        const weatherUrl10Days = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&forecast_days=10&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;

        const [weatherRes, aqiRes, tenDaysRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl),
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