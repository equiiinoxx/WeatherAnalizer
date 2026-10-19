
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

# Rolling one-year period, ending today.
end_date = date.today()
start_date = end_date - timedelta(days=365)

# Approximate coordinates for each city.
locations = {
    "Visakhapatnam": (17.6868, 83.2185),
    "Vijayawada": (16.5062, 80.6480),
    "Kakinada": (16.9891, 82.2475),
    "Rajahmundry": (17.0005, 81.8040),
    "Tirupati": (13.6288, 79.4192),
    "Nellore": (14.4426, 79.9865),
    "Kurnool": (15.8281, 78.0373),
    "Anantapur": (14.6819, 77.6006),
}

base_url = (
    "https://power.larc.nasa.gov/api/temporal/"
    "daily/point"
)

start = start_date.strftime("%Y%m%d")
end = end_date.strftime("%Y%m%d")

all_frames = []

for location, (latitude, longitude) in locations.items():
    print(f"Downloading: {location}")

    params = {
        "parameters": "T2M,RH2M,PRECTOTCORR",
        "community": "RE",
        "latitude": latitude,
        "longitude": longitude,
        "start": start,
        "end": end,
        "format": "JSON",
        "time-standard": "LST",
    }

    response = requests.get(
        base_url, params=params, timeout=90
    )
    response.raise_for_status()
    payload = response.json()

    if "properties" not in payload:
        raise RuntimeError(
            f"Unexpected API response for {location}: "
            f"{payload}"
        )

    parameters = payload["properties"]["parameter"]

    frame = pd.DataFrame({
        "observation_date": pd.to_datetime(
            list(parameters["T2M"].keys()),
            format="%Y%m%d",
            errors="coerce",
        ).strftime("%Y-%m-%d"),
        "location": location,
        "temperature": list(parameters["T2M"].values()),
        "humidity": list(parameters["RH2M"].values()),
        "rainfall": list(
            parameters["PRECTOTCORR"].values()
        ),
    })

    # NASA POWER uses -999 for unavailable values.
    for column in ["temperature", "humidity", "rainfall"]:
        frame[column] = pd.to_numeric(
            frame[column], errors="coerce"
        )
        frame[column] = frame[column].where(
            frame[column] != -999
        )

    all_frames.append(frame)

result = pd.concat(all_frames, ignore_index=True)

# Preserve missing values as blank CSV cells.
output_dir = Path("sample_data")
output_dir.mkdir(exist_ok=True)

output_file = output_dir / "weather_project_import.csv"
result.to_csv(output_file, index=False, na_rep="")

print("\nDownload completed.")
print(f"Period: {start_date} to {end_date}")
print(f"Rows: {len(result)}")
print(f"Locations: {result['location'].nunique()}")
print(f"Missing values:\n{result.isna().sum()}")
print(f"\nCSV saved to: {output_file.resolve()}")
print(result.head(10).to_string(index=False))
