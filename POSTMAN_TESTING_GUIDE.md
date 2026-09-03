# BariVara Postman Testing Guide

This guide will help you test the core API endpoints of the BariVara backend using Postman.

## Base URL
All endpoints are relative to: `http://localhost:3000/api/v1`

## Localization (Language)
BariVara supports English (`en`) and Bangla (`bn`). By default, error messages and responses are in Bangla. 
To receive English responses, add the following header to your requests:
- **Key**: `Accept-Language`
- **Value**: `en`

## Authentication & Authorization
Most endpoints require a valid JWT access token. Add this to your Postman request under the **Authorization** tab:
- **Type**: `Bearer Token`
- **Token**: `<your_access_token>`

---

## 1. Health Check
- **Endpoint:** `GET /health`
- **Description:** Check if the server is running.
- **Auth Required:** No

## 2. Authentication
### Register
- **Endpoint:** `POST /auth/register`
- **Auth Required:** No
- **Body (raw JSON):**
```json
{
  "name": "Asif Test Owner",
  "email": "owner@barivara.com",
  "phone": "01700112233",
  "password": "Password123!"
}
```

### Login
- **Endpoint:** `POST /auth/login`
- **Auth Required:** No
- **Body (raw JSON):**
```json
{
  "identifier": "owner@barivara.com",
  "password": "Password123!"
}
```
*(Copy the `accessToken` from the response to use in the Authorization header for subsequent requests)*

---

## 3. Property Management
### Create Property
- **Endpoint:** `POST /properties`
- **Body (raw JSON):**
```json
{
  "name": "Green View Tower",
  "address": "House 10, Road 5, Dhanmondi, Dhaka",
  "city": "Dhaka",
  "district": "Dhaka",
  "totalFloors": 5
}
```
*(Save the `id` from the response as `propertyId`)*

### Create Unit
- **Endpoint:** `POST /properties/:propertyId/units` (Replace `:propertyId` with actual ID)
- **Body (raw JSON):**
```json
{
  "unitNumber": "4A",
  "floor": 4,
  "unitType": "APARTMENT",
  "bedrooms": 3,
  "bathrooms": 2,
  "monthlyBaseRent": 20000,
  "defaultServiceFee": 3000,
  "defaultParkingFee": 2000,
  "defaultExtraCharge": 500
}
```
*(Save the `id` from the response as `unitId`)*

---

## 4. Tenant & Agreement Management
### Create Tenant
- **Endpoint:** `POST /tenants`
- **Body (raw JSON):**
```json
{
  "name": "Kamal Hossain",
  "phone": "01899112233",
  "email": "kamal.test@example.com",
  "nid": "1234567890123",
  "occupation": "Software Engineer"
}
```
*(Save the `id` from the response as `tenantId`)*

### Create Rental Agreement
- **Endpoint:** `POST /rental-agreements`
- **Body (raw JSON):**
```json
{
  "tenantId": "<tenantId>",
  "unitId": "<unitId>",
  "monthlyRent": 20000,
  "serviceFee": 3000,
  "parkingFee": 2000,
  "extraCharge": 500,
  "dueDay": 5,
  "securityDeposit": 40000,
  "startDate": "2026-09-01T00:00:00.000Z"
}
```

---

## 5. Rent & Payments
### Generate Monthly Rent
- **Endpoint:** `POST /monthly-rents/generate`
- **Body (raw JSON):**
```json
{
  "year": 2026,
  "month": 9,
  "propertyId": "<propertyId>"
}
```

### List Monthly Rents
- **Endpoint:** `GET /monthly-rents?propertyId=<propertyId>&year=2026&month=9`
*(Save the `id` of a rent from the response as `monthlyRentId`)*

### Record Payment
- **Endpoint:** `POST /payments`
- **Body (raw JSON):**
```json
{
  "monthlyRentId": "<monthlyRentId>",
  "amount": 25500,
  "paymentMethod": "BKASH",
  "transactionId": "BKASH-001",
  "note": "September full payment"
}
```
*(Save the `id` of the payment as `paymentId` to test reversal)*

### Reverse Payment
- **Endpoint:** `POST /payments/:id/reverse` (Replace `:id` with `paymentId`)

---

## 6. Dashboard
### Get Dashboard Overview
- **Endpoint:** `GET /dashboard/overview?propertyId=<propertyId>&year=2026&month=9`
