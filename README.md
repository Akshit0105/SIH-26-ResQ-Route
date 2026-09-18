# 🚑 ResQ-Route

> **Real-Time Emergency Response Coordination Platform**

ResQ-Route is a real-time emergency response coordination platform that connects **families/citizens, ambulance drivers, and hospitals** through a shared digital workflow.

The platform is designed to reduce coordination delays during emergencies by synchronizing emergency status, ambulance location, patient information, hospital coordination, and resource allocation through a centralized backend.

---

## 🎯 Problem Statement

Emergency response often involves multiple disconnected stakeholders:

```text
Family → Ambulance → Hospital → Bed/Resource → Patient Care
```

When these stakeholders do not have a shared view of the emergency, valuable time can be lost in communication and coordination.

### ResQ-Route aims to provide one connected workflow:

```text
Emergency Report
      ↓
Location Capture
      ↓
Ambulance Coordination
      ↓
Hospital Coordination
      ↓
Live Ambulance Tracking
      ↓
Patient Information / Vitals
      ↓
Hospital Resource Preparation
      ↓
Bed Allocation
      ↓
Hospital Arrival
```

---

## 💡 Solution

ResQ-Route provides role-based dashboards for three major stakeholders:

| Role | Dashboard | Responsibilities |
|---|---|---|
| 👨‍👩‍👧 Family | `family.html` | Report and monitor emergencies |
| 🚑 Ambulance Driver | `ambulance.html` | Accept emergencies, navigate, update status and location |
| 🏥 Hospital | `hospital.html` | Receive emergencies, monitor patients and manage resources |

The system uses a shared emergency record in Supabase so that changes can be reflected across the relevant dashboards.

---

## ⭐ Key Features

### 1. 🚨 Emergency Reporting

Families can create an emergency request with:

- Patient information
- Emergency type
- Priority
- Location
- Browser-based GPS location

---

### 2. 🚑 Ambulance Coordination

The system can identify available ambulances and compare their geographic distance from the emergency location.

Conceptually:

```text
Emergency Location
       ↓
Available Ambulances
       ↓
Distance Calculation
       ↓
Nearby Available Ambulance
```

---

### 3. 🗺️ Live Mapping & Routing

The ambulance and hospital interfaces use:

- **Leaflet** for interactive maps
- **OSRM** for road routing and route/ETA information when available
- **Browser Geolocation API** for location updates

Maps can display:

- Patient location
- Ambulance location
- Hospital destination
- Road route

---

### 4. 🔄 Real-Time Synchronization

Supabase Realtime is used to synchronize important emergency information.

The realtime layer can handle:

- Emergency status
- Ambulance location
- Patient vitals
- Emergency timeline/events
- Ambulance assignment
- Hospital assignment
- Notifications

Conceptually:

```text
              SUPABASE REALTIME
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
     FAMILY      AMBULANCE     HOSPITAL
        │            │            │
      Track        Update       Prepare
      Status       GPS          Patient
```

---

### 5. 🏥 Hospital Coordination

The hospital can receive information about incoming emergencies before the ambulance reaches the hospital.

Hospital staff can view:

- Active emergency patients
- Emergency priority
- Patient information
- Patient vitals
- Ambulance information
- Hospital resource availability

---

### 6. 🛏️ Smart Bed Allocation

One of the major features is hospital bed/resource management.

The automatic allocation workflow is:

```text
Emergency
    ↓
Hospital Receives Emergency
    ↓
Find Available Beds
    ↓
Determine Suitable Room Type
    ↓
Select Suitable Bed
    ↓
Reserve Bed
    ↓
Hospital Confirms / Changes
    ↓
Patient Arrives
    ↓
Bed → OCCUPIED
```

The system considers emergency characteristics such as:

- Priority
- Emergency type
- Required care level
- Room type
- Bed availability

---

### 7. ⏱️ Bed Reservation & Confirmation

A recommended bed can be reserved before the patient physically arrives.

This creates an important distinction:

```text
AVAILABLE
    ↓
RESERVED
    ↓
Patient Arrives
    ↓
OCCUPIED
```

**Reservation** means the hospital is preparing the resource.

**Occupied** means the resource is physically being used.

The automatic allocation workflow provides a short confirmation window for hospital staff before continuing with the selected resource.

---

### 8. 🏢 Floor → Room → Bed Management

For hospitals with hundreds or thousands of beds, displaying every bed in one long list is inefficient.

ResQ-Route uses hierarchical navigation:

```text
Hospital
   ↓
Floor
   ↓
Room
   ↓
Bed
```

Example:

```text
Floor 2
 ├── Room 201 — 3 beds free
 ├── Room 202 — 1 bed free
 ├── Room 203 — 0 beds free
 └── Room 204 — 4 beds free
```

Staff can then open a room and select an exact available bed.

---

### 9. 🔁 Allocate / Deallocate

Hospital staff can manually manage a patient's bed.

```text
No Bed
  ↓
ALLOCATE BED
  ↓
Patient Assigned
  ↓
MANAGE BED
  ↓
DEALLOCATE BED
  ↓
Bed Available Again
```

Allocation activity can also be recorded in the emergency timeline.

---

### 10. 📋 Emergency Timeline

Emergency events can be recorded as a timeline, for example:

```text
Emergency Reported
       ↓
Ambulance Assigned
       ↓
Driver Accepted
       ↓
Ambulance Arrived at Patient
       ↓
Patient Onboard
       ↓
Arrived at Hospital
       ↓
Bed Allocated
```

This provides traceability for the emergency lifecycle.

---

## 🔄 Emergency Status Lifecycle

The emergency workflow uses explicit states rather than a simple active/inactive flag.

```text
REPORTED
   ↓
DISPATCHING
   ↓
ASSIGNED
   ↓
DRIVER_ACCEPTED
   ↓
EN_ROUTE_TO_PATIENT
   ↓
ARRIVED_AT_PATIENT
   ↓
PATIENT_ONBOARD
   ↓
EN_ROUTE_TO_HOSPITAL
   ↓
ARRIVED_AT_HOSPITAL
   ↓
COMPLETED
```

This allows each dashboard to understand the current stage of an emergency.

---

## 🧱 System Architecture

```text
                         ┌─────────────────────┐
                         │       FAMILY        │
                         │   Report Emergency  │
                         └──────────┬──────────┘
                                    │
                                    ↓
                         ┌─────────────────────┐
                         │      SUPABASE       │
                         │                     │
                         │  Authentication     │
                         │  PostgreSQL DB      │
                         │  Realtime           │
                         └──────┬───────┬──────┘
                                │       │
                   ┌────────────┘       └────────────┐
                   ↓                                 ↓
          ┌─────────────────┐              ┌─────────────────┐
          │    AMBULANCE    │              │     HOSPITAL    │
          │                 │              │                 │
          │ Accept          │              │ Emergencies     │
          │ GPS             │              │ Patients        │
          │ Route           │              │ Vitals          │
          │ Status          │              │ Bed Allocation  │
          └─────────────────┘              └─────────────────┘
                   │                                 │
                   └──────────────┬──────────────────┘
                                  ↓
                           REAL-TIME SYNC
```

---

## 🗄️ Database Structure

The application uses PostgreSQL through Supabase.

Important entities include:

### `profiles`

Stores user information and role.

```text
name
email
phone
role
```

Roles include:

```text
family
driver
hospital
```

### `patients`

Stores patient-related information such as:

```text
name
age
gender
blood group
allergies
medical conditions
consent
```

### `emergencies`

The central emergency record.

Typical information includes:

```text
patient
requester
emergency type
priority
latitude
longitude
ambulance
hospital
status
timestamps
```

### `ambulances`

Stores ambulance and driver information, including:

```text
vehicle
driver
type
status
location
equipment
```

### `hospitals`

Stores hospital information and resource/availability information.

### `emergency_events`

Stores the emergency timeline/audit trail.

### `ambulance_locations`

Stores location updates such as:

```text
ambulance
emergency
latitude
longitude
speed
timestamp
```

### `patient_vitals`

Stores patient monitoring data such as:

```text
heart rate
SpO2
blood pressure
temperature
ECG status
timestamp
```

### `hospital_resource_slots`

Represents hospital resources such as beds.

### `resource_allocations`

Records which hospital resources have been allocated to which emergency/patient.

---

## 🔐 Authentication & Roles

Authentication is handled through **Supabase Auth**.

After authentication, users are routed according to their role:

```text
Family
   ↓
family.html

Driver / Ambulance
   ↓
ambulance.html

Hospital / Hospital Staff
   ↓
hospital.html
```

Role-based access is part of the application architecture.

For production deployment, database-level Row Level Security (RLS) should be fully configured and tested so users can access only the records appropriate to their role.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| HTML | Application structure |
| CSS | User interface and responsive styling |
| JavaScript | Application logic |
| Supabase | Backend platform |
| PostgreSQL | Relational database |
| Supabase Auth | Authentication |
| Supabase Realtime | Live synchronization |
| Leaflet | Interactive maps |
| OSRM | Road routing |
| Browser Geolocation API | GPS/location updates |

---

## 📁 Important Project Files

```text
ResQ-Route/
│
├── family.html
├── ambulance.html
├── hospital.html
├── emergency.html
├── emergency-patients.html
├── hospital-layout.html
├── signin.html
├── signup.html
├── terms.html
│
├── js/
│   ├── auth.js
│   ├── supabase.js
│   ├── emergency.js
│   ├── realtime.js
│   └── bed-allocation.js
│
└── README.md
```

### Main JavaScript modules

#### `js/auth.js`

Handles authentication, roles and dashboard routing.

#### `js/supabase.js`

Initializes the Supabase client.

#### `js/emergency.js`

Handles emergency creation and emergency-related coordination logic.

#### `js/realtime.js`

Handles realtime synchronization for emergency-related updates.

#### `js/bed-allocation.js`

Handles automatic hospital bed/resource allocation logic.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Akshit0105/SIH-26-ResQ-Route.git
cd SIH-26-ResQ-Route
```

### 2. Configure Supabase

Create a Supabase project and configure the database tables, authentication and realtime features required by the application.

Update the Supabase configuration used by the project.

### 3. Run the frontend

Because the project is primarily HTML/CSS/JavaScript, it can be served using a local static server.

For example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Using a local server is recommended instead of opening the HTML files directly with `file://`.

---

## 🎬 Recommended Demo Flow

For a hackathon demonstration:

### Step 1 — Family

1. Sign in as a family user.
2. Create an emergency.
3. Enter patient/emergency information.
4. Capture or provide the location.
5. Submit the emergency.

### Step 2 — Ambulance

1. Open the ambulance dashboard.
2. Show the incoming emergency.
3. Accept the emergency.
4. Show the map and route.
5. Demonstrate status/location updates.

### Step 3 — Hospital

1. Open the hospital dashboard.
2. Show the incoming emergency.
3. Open the emergency patient view.
4. Show patient information and emergency status.

### Step 4 — Bed Allocation

1. Click **ALLOCATE BED**.
2. Select a floor.
3. Select a room.
4. Select an available bed.
5. Allocate the bed.
6. Open **MANAGE BED**.
7. Demonstrate **DEALLOCATE BED**.

This demonstrates the complete workflow:

```text
Family
  ↓
Emergency
  ↓
Ambulance
  ↓
Hospital
  ↓
Patient
  ↓
Bed
```

---

## 🧠 Why This Architecture?

### Why Supabase?

Supabase provides:

- Authentication
- PostgreSQL database
- APIs
- Realtime subscriptions

This allows the prototype to implement a connected multi-user workflow without building a separate backend server from scratch.

### Why PostgreSQL?

Emergency response data is highly relational:

```text
Patient
   ↓
Emergency
   ├── Ambulance
   ├── Hospital
   ├── Vitals
   ├── Events
   └── Resource Allocation
```

A relational database is therefore a natural fit.

### Why Leaflet?

Leaflet is lightweight and suitable for browser-based interactive maps and live markers.

### Why OSRM?

OSRM provides road-based routing so the application can calculate a drivable route rather than simply drawing a straight line between two coordinates.

---

## 🤖 AI Roadmap

The current prototype's core workflow is primarily based on **rules, geospatial calculations, database state and realtime synchronization**.

AI/ML can be added on top of this architecture for:

### Intelligent Triage

```text
Symptoms + Vitals
       ↓
    ML Model
       ↓
Severity Prediction
```

### ETA Prediction

```text
GPS + Historical Traffic
       ↓
    ML Model
       ↓
Predicted ETA
```

### Hospital Capacity Forecasting

```text
Historical Admissions
       +
Emergency Trends
       ↓
      ML
       ↓
Expected Bed Demand
```

### Future Intelligent Routing

Traffic, road conditions, ambulance availability and hospital capacity could be combined into a multi-factor optimization system.

---

## 🔒 Security & Production Considerations

This project is a functional prototype.

A production deployment would require additional work including:

- Complete Supabase Row Level Security policies
- Stronger concurrency guarantees for resource allocation
- PostgreSQL transactions/RPCs for high-concurrency bed allocation
- Secure handling of sensitive patient data
- Hospital/EHR integration
- Reliable GPS handling
- Production-grade routing infrastructure
- Audit and compliance requirements
- Clinical validation
- Monitoring and observability
- Offline/poor-network support

The current prototype uses conditional database updates during resource allocation to reduce the chance of two clients selecting the same available bed. A production system should use stronger database transaction/locking guarantees for high concurrency.

---

## 🔮 Future Scope

Potential future improvements include:

- 🤖 AI-assisted emergency triage
- 🚦 Traffic-aware ambulance routing
- 📊 Predictive hospital capacity
- 🛏️ Predictive bed-demand forecasting
- ❤️ IoT-based patient monitoring
- 🏥 Multi-hospital resource sharing
- 📡 Offline/poor-network support
- 🚨 Integration with government/emergency services
- 🔐 Advanced healthcare data security
- 📱 Dedicated mobile applications
- 📈 Emergency response analytics

---

## 📌 Project Highlights

The key idea behind ResQ-Route is not just creating separate dashboards.

It is connecting the **complete emergency lifecycle**:

```text
Emergency
    ↓
Location
    ↓
Ambulance
    ↓
Hospital
    ↓
Patient Monitoring
    ↓
Resource Preparation
    ↓
Bed Allocation
    ↓
Care
```

The central architectural principle is:

> **A shared, realtime emergency state that allows family, ambulance and hospital interfaces to stay synchronized.**

---

## 👥 Project Team

```text
Team Name: Algnites

Members:
1. Rohit Jandial 
2. Akshit Bhardwaj 
3. Harjot Singh
4. Gurmehak Kaur
5. Gurleen Kaur
6. Alice Chawla
```

---
## 🚑 ResQ-Route

**Emergency → Location → Ambulance → Hospital → Realtime → Patient → Bed**

> *Connecting the emergency response lifecycle through one coordinated platform.*
