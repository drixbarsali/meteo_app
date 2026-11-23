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

        // 2. Fetch current weather + air quality in parallel
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&timezone=auto`;
        const aqiUrl = `https://api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi&timezone=auto`;

        const [weatherRes, aqiRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
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