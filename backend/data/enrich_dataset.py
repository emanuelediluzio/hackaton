"""
Script to enrich the Kaggle Ghana Health Facilities dataset with synthetic
unstructured text (capabilities, equipment, services) for RAG/IDP purposes.
We keep the real structured data (name, region, district, type, lat, lng, ownership)
and add realistic unstructured fields for the hackathon.
"""
import csv
import json
import random
import hashlib
from pathlib import Path

random.seed(42)

DATA_DIR = Path(__file__).parent

# Load Kaggle CSV
kaggle_rows = []
with open(DATA_DIR / "ghana_health_facilities_kaggle.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        kaggle_rows.append(row)

# Filter to actual healthcare facilities (not directorates/training)
FACILITY_TYPES = {
    "Hospital", "District Hospital", "Regional Hospital", "Teaching Hospital",
    "Psychiatric Hospital", "Municipal Hospital", "Metropolitan Hospital",
    "Polyclinic", "Health Centre", "Clinic", "clinic", "CHPS", "CPHS",
    "Maternity Home", "RCH", "Centre"
}
facilities_raw = [r for r in kaggle_rows if r["Type"] in FACILITY_TYPES]

print(f"Filtered to {len(facilities_raw)} healthcare facilities from {len(kaggle_rows)} total rows")

# ── Templates for generating unstructured text ──

EQUIPMENT_BY_TYPE = {
    "Teaching Hospital": ["MRI", "CT Scanner", "X-Ray", "Ultrasound", "Ventilators", "ECG", "Dialysis Machines", "Endoscopy", "Mammography", "Defibrillators"],
    "Regional Hospital": ["CT Scanner", "X-Ray", "Ultrasound", "Ventilators", "ECG", "Endoscopy", "Defibrillators"],
    "District Hospital": ["X-Ray", "Ultrasound", "ECG", "Basic Lab Equipment", "Defibrillators"],
    "Municipal Hospital": ["CT Scanner", "X-Ray", "Ultrasound", "ECG", "Endoscopy"],
    "Metropolitan Hospital": ["CT Scanner", "X-Ray", "Ultrasound", "ECG", "Endoscopy", "MRI"],
    "Polyclinic": ["X-Ray", "Ultrasound", "ECG", "Basic Lab Equipment"],
    "Hospital": ["X-Ray", "Ultrasound", "ECG", "Basic Lab Equipment"],
    "Health Centre": ["Basic X-Ray", "Microscope", "Hemoglobin Testing", "Blood Pressure Monitor"],
    "Clinic": ["Microscope", "Blood Pressure Monitor", "Glucometer", "Basic First Aid"],
    "clinic": ["Microscope", "Blood Pressure Monitor", "Glucometer", "Basic First Aid"],
    "CHPS": ["Thermometer", "Blood Pressure Monitor", "Basic First Aid Kit", "Weighing Scale"],
    "CPHS": ["Thermometer", "Blood Pressure Monitor", "Basic First Aid Kit", "Weighing Scale"],
    "Maternity Home": ["Ultrasound", "Fetal Doppler", "Delivery Kit", "Blood Pressure Monitor"],
    "RCH": ["Weighing Scale", "Thermometer", "Immunization Equipment", "Growth Charts"],
    "Centre": ["Basic Lab Equipment", "Microscope", "Blood Pressure Monitor"],
    "Psychiatric Hospital": ["ECG", "Basic Lab Equipment", "Restraint Equipment"],
}

SPECIALTIES_BY_TYPE = {
    "Teaching Hospital": ["Surgery", "Internal Medicine", "Pediatrics", "Obstetrics", "Cardiology", "Neurology", "Oncology", "Ophthalmology", "Orthopedics", "ENT"],
    "Regional Hospital": ["Surgery", "Internal Medicine", "Pediatrics", "Obstetrics", "Orthopedics"],
    "District Hospital": ["General Medicine", "Surgery", "Obstetrics"],
    "Municipal Hospital": ["Surgery", "Internal Medicine", "Pediatrics", "Obstetrics"],
    "Metropolitan Hospital": ["Surgery", "Internal Medicine", "Pediatrics", "Obstetrics", "Cardiology"],
    "Polyclinic": ["General Medicine", "Obstetrics", "Pediatrics"],
    "Hospital": ["General Medicine", "Surgery", "Obstetrics"],
    "Health Centre": ["General Medicine"],
    "Clinic": [],
    "clinic": [],
    "CHPS": [],
    "CPHS": [],
    "Maternity Home": ["Obstetrics"],
    "RCH": ["Pediatrics"],
    "Centre": ["General Medicine"],
    "Psychiatric Hospital": ["Psychiatry", "Psychology"],
}

SERVICES_BY_TYPE = {
    "Teaching Hospital": ["Emergency", "ICU", "Surgery", "Radiology", "Laboratory", "Pharmacy", "Blood Bank", "Physiotherapy", "Dental", "Mental Health"],
    "Regional Hospital": ["Emergency", "Surgery", "Radiology", "Laboratory", "Pharmacy", "Blood Bank", "Maternity"],
    "District Hospital": ["Emergency", "Basic Surgery", "Laboratory", "Pharmacy", "Maternity"],
    "Municipal Hospital": ["Emergency", "Surgery", "Laboratory", "Pharmacy", "Maternity", "Radiology"],
    "Metropolitan Hospital": ["Emergency", "ICU", "Surgery", "Radiology", "Laboratory", "Pharmacy", "Blood Bank"],
    "Polyclinic": ["Outpatient", "Laboratory", "Pharmacy", "Maternity", "Dental"],
    "Hospital": ["Emergency", "Basic Surgery", "Laboratory", "Pharmacy", "Maternity"],
    "Health Centre": ["Outpatient", "Basic Emergency", "Immunization", "Family Planning", "Pharmacy"],
    "Clinic": ["Outpatient", "Pharmacy"],
    "clinic": ["Outpatient", "Pharmacy"],
    "CHPS": ["Outpatient", "Immunization", "Family Planning", "Health Education"],
    "CPHS": ["Outpatient", "Immunization", "Family Planning", "Health Education"],
    "Maternity Home": ["Maternity", "Family Planning", "Antenatal Care"],
    "RCH": ["Child Welfare", "Immunization", "Growth Monitoring"],
    "Centre": ["Outpatient", "Laboratory"],
    "Psychiatric Hospital": ["Inpatient", "Outpatient", "Counseling", "Rehabilitation"],
}

BED_RANGES = {
    "Teaching Hospital": (500, 2000),
    "Regional Hospital": (150, 400),
    "District Hospital": (40, 150),
    "Municipal Hospital": (100, 300),
    "Metropolitan Hospital": (200, 500),
    "Polyclinic": (20, 80),
    "Hospital": (30, 200),
    "Health Centre": (5, 30),
    "Clinic": (0, 10),
    "clinic": (0, 10),
    "CHPS": (0, 5),
    "CPHS": (0, 5),
    "Maternity Home": (5, 30),
    "RCH": (0, 5),
    "Centre": (5, 20),
    "Psychiatric Hospital": (50, 300),
}

STAFF_RANGES = {
    "Teaching Hospital": (1500, 4000),
    "Regional Hospital": (300, 800),
    "District Hospital": (50, 200),
    "Municipal Hospital": (150, 400),
    "Metropolitan Hospital": (300, 700),
    "Polyclinic": (30, 100),
    "Hospital": (40, 250),
    "Health Centre": (10, 40),
    "Clinic": (3, 20),
    "clinic": (3, 20),
    "CHPS": (2, 8),
    "CPHS": (2, 8),
    "Maternity Home": (5, 25),
    "RCH": (3, 12),
    "Centre": (5, 20),
    "Psychiatric Hospital": (50, 200),
}

STATUS_OPTIONS_GOOD = ["Fully Operational", "Operational"]
STATUS_OPTIONS_MID = ["Operational - Limited Specialist Coverage", "Operational - Developing"]
STATUS_OPTIONS_BAD = ["Operational - Resource Constrained", "Operational - Minimal Capacity", "Operational - Critical Capacity", "Operational - Severely Resource Constrained"]

NORTHERN_REGIONS = {"Northern", "Upper East", "Upper West"}
CAPABILITY_TEMPLATES_HOSPITAL = [
    "This {type} serves the {district} district in the {region} region. The facility provides {services_text}. Current bed capacity is {beds} with approximately {staff} healthcare workers. {equip_text} {challenge_text} {special_text}",
    "{name} is a {ownership}-owned {type} located in {town}, {region}. It offers services including {services_text}. The facility has {beds} beds and {staff} staff members. {equip_text} {challenge_text} {special_text}",
    "Located in {town}, {district}, the {name} functions as a {type} under {ownership} management. Services available: {services_text}. Infrastructure includes {beds} inpatient beds. Staffing level: {staff}. {equip_text} {challenge_text} {special_text}",
]

CAPABILITY_TEMPLATES_SMALL = [
    "{name} is a {ownership}-run {type} in {town}, {district} ({region}). The facility provides basic healthcare services to the local community. {services_text}. {equip_text} {challenge_text}",
    "This {type} in {town} serves the surrounding communities of {district}. {services_text}. Staff consists of {staff} health workers. {equip_text} {challenge_text}",
]

CHALLENGES_NORTHERN = [
    "The facility faces significant challenges including chronic understaffing, limited specialist coverage, and poor road infrastructure for referrals.",
    "Staff retention remains a critical issue as healthcare workers prefer urban postings. Equipment maintenance is irregular due to funding constraints.",
    "The remote location presents major challenges for emergency referrals. During rainy season, road access can be severely compromised.",
    "Critical resource shortages persist. The facility lacks reliable power supply and clean water infrastructure.",
    "Distance to the nearest referral center (4+ hours by road) puts patients at risk for conditions requiring urgent surgical intervention.",
]

CHALLENGES_GENERAL = [
    "The facility faces periodic challenges with equipment maintenance and supply chain disruptions.",
    "Patient volume has increased significantly due to population growth in the catchment area.",
    "The facility is working to expand its specialist services through partnerships with teaching hospitals.",
    "Infrastructure improvements are needed to meet growing demand. Recent government investment has helped upgrade some departments.",
    "The facility serves as a key node in the regional healthcare network, handling referrals from surrounding health centers.",
]

SPECIAL_NOTES_GOOD = [
    "The hospital has partnerships with international medical organizations for visiting specialist programs.",
    "Recent investments have improved diagnostic capabilities and emergency response capacity.",
    "The facility serves as a training site for medical students and community health workers.",
    "A telemedicine program links the facility with teaching hospitals for remote specialist consultations.",
]

SPECIAL_NOTES_BAD = [
    "MEDICAL DESERT indicator: The facility cannot manage surgical emergencies and must refer cases over long distances.",
    "Healthcare gap: No specialist physicians available. Care relies on physician assistants and nurses.",
    "Critical gap: No blood bank, no surgical theater, minimal diagnostic equipment. Patients requiring anything beyond basic care must travel hours to reach appropriate facilities.",
    "This area represents a significant medical desert. The population-to-facility ratio far exceeds WHO recommendations.",
]

def generate_capabilities_text(fac_data):
    ftype = fac_data["type"]
    region = fac_data["region"]
    is_northern = region in NORTHERN_REGIONS
    is_small = ftype in ("CHPS", "CPHS", "Clinic", "clinic", "RCH", "Health Centre", "Maternity Home")
    
    services = fac_data.get("services", [])
    services_text = ", ".join(services[:5]) if services else "basic outpatient care"
    equipment = fac_data.get("equipment", [])
    equip_text = f"Available equipment includes {', '.join(equipment[:4])}." if equipment else "Equipment is limited to basic supplies."
    
    if is_northern and is_small:
        challenge_text = random.choice(CHALLENGES_NORTHERN)
        special_text = random.choice(SPECIAL_NOTES_BAD)
    elif is_northern:
        challenge_text = random.choice(CHALLENGES_NORTHERN)
        special_text = random.choice(SPECIAL_NOTES_GOOD) if random.random() > 0.5 else random.choice(SPECIAL_NOTES_BAD)
    elif is_small:
        challenge_text = random.choice(CHALLENGES_GENERAL)
        special_text = ""
    else:
        challenge_text = random.choice(CHALLENGES_GENERAL)
        special_text = random.choice(SPECIAL_NOTES_GOOD)
    
    template = random.choice(CAPABILITY_TEMPLATES_SMALL if is_small else CAPABILITY_TEMPLATES_HOSPITAL)
    
    return template.format(
        name=fac_data["name"],
        type=ftype,
        region=region,
        district=fac_data["district"],
        town=fac_data["town"],
        ownership=fac_data["ownership"],
        beds=fac_data["beds"],
        staff=fac_data["staff_count"],
        services_text=services_text,
        equip_text=equip_text,
        challenge_text=challenge_text,
        special_text=special_text,
    ).strip()


def generate_notes(fac_data):
    ftype = fac_data["type"]
    region = fac_data["region"]
    is_northern = region in NORTHERN_REGIONS
    is_small = ftype in ("CHPS", "CPHS", "Clinic", "clinic", "RCH", "Health Centre")
    
    notes = []
    if is_northern and is_small:
        notes.append("MEDICAL DESERT")
    elif is_northern and fac_data.get("beds", 0) < 50:
        notes.append("MEDICAL DESERT")
    
    if fac_data.get("beds", 0) < 20:
        notes.append("Very limited capacity")
    if ftype in ("Teaching Hospital", "Regional Hospital"):
        notes.append("Key referral facility")
    if fac_data["ownership"] in ("CHAG", "Mission"):
        notes.append("Faith-based management")
    if fac_data["ownership"] == "Private":
        notes.append("Private sector facility")
    
    return ". ".join(notes) + "." if notes else "Standard facility."


# Build enriched dataset
enriched = []
for i, row in enumerate(facilities_raw):
    ftype = row["Type"]
    if ftype in ("CPHS",):
        ftype = "CHPS"
    
    # Deterministic random based on facility name
    seed = int(hashlib.md5(row["FacilityName"].encode()).hexdigest()[:8], 16)
    random.seed(seed)
    
    bed_range = BED_RANGES.get(ftype, (5, 50))
    staff_range = STAFF_RANGES.get(ftype, (3, 30))
    
    equipment = EQUIPMENT_BY_TYPE.get(ftype, ["Basic First Aid"])
    # Randomly select subset
    n_equip = max(1, len(equipment) - random.randint(0, 3))
    equipment = random.sample(equipment, min(n_equip, len(equipment)))
    
    specialties = SPECIALTIES_BY_TYPE.get(ftype, [])
    if specialties:
        n_spec = max(1, len(specialties) - random.randint(0, 2))
        specialties = random.sample(specialties, min(n_spec, len(specialties)))
    
    services = SERVICES_BY_TYPE.get(ftype, ["Outpatient"])
    n_serv = max(1, len(services) - random.randint(0, 2))
    services = random.sample(services, min(n_serv, len(services)))
    
    beds = random.randint(*bed_range)
    staff = random.randint(*staff_range)
    
    is_northern = row["Region"] in NORTHERN_REGIONS
    is_small = ftype in ("CHPS", "Clinic", "clinic", "RCH", "Health Centre", "Maternity Home")
    
    if is_northern and is_small:
        status = random.choice(STATUS_OPTIONS_BAD)
    elif is_northern:
        status = random.choice(STATUS_OPTIONS_MID + STATUS_OPTIONS_BAD)
    elif is_small:
        status = random.choice(STATUS_OPTIONS_GOOD + STATUS_OPTIONS_MID)
    else:
        status = random.choice(STATUS_OPTIONS_GOOD)
    
    lat = float(row["Latitude"]) if row["Latitude"] else 7.5 + random.uniform(-2, 2)
    lng = float(row["Longitude"]) if row["Longitude"] else -1.5 + random.uniform(-1.5, 1.5)
    
    fac = {
        "facility_id": f"GH-{i+1:04d}",
        "name": row["FacilityName"],
        "region": row["Region"],
        "district": row["District"],
        "town": row.get("Town", ""),
        "type": ftype,
        "ownership": row["Ownership"],
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "beds": beds,
        "staff_count": staff,
        "specialties": specialties,
        "equipment": equipment,
        "services": services,
        "operational_status": status,
    }
    
    fac["capabilities_text"] = generate_capabilities_text(fac)
    fac["notes"] = generate_notes(fac)
    fac["last_inspection"] = f"202{random.randint(3,4)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"
    
    enriched.append(fac)

# Write enriched dataset
output_path = DATA_DIR / "ghana_facilities.json"
with open(output_path, "w") as f:
    json.dump(enriched, f, indent=2)

print(f"Generated {len(enriched)} enriched facility records")
print(f"Output: {output_path}")

# Stats
desert_count = sum(1 for f in enriched if "MEDICAL DESERT" in f.get("notes", ""))
print(f"Medical deserts flagged: {desert_count}")
print(f"Regions: {len(set(f['region'] for f in enriched))}")
print(f"Types: {len(set(f['type'] for f in enriched))}")
