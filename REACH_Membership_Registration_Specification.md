# REACH Membership Management System

## Membership Registration — Design and Functional Specification

### 1. Project Overview

This document defines the membership and registration workflow for the **REACH Pravasi Welfare Society Membership Management System**. The website must retain the existing REACH visual identity and dashboard design.

### 2. Visual Design

- Use the official REACH logo in the header and navigation area.
- Primary colour: deep royal blue.
- Secondary colour: teal.
- Accent colours: green and orange.
- Background: white and very light blue-grey.
- Use rounded cards, light borders, subtle shadows and clear section spacing.
- The form must be fully responsive for desktop, tablet and mobile devices.
- Display a step indicator and completion progress bar throughout registration.

### 3. Registration Flow

The recommended registration flow is:

1. Membership Selection
2. Personal Information
3. Expat Status
4. Expat or Retired Details
5. Review and Submit
6. Confirmation

Form data must remain available when the applicant moves backward or forward between steps.

---

## 4. Membership Selection

Membership selection must appear before all other registration fields. The applicant must select one option.

### 4.1 Two-Year Membership

- Validity: **1 January 2027 to 31 December 2028**
- Fee: **₹300**

### 4.2 Lifetime Membership

- Validity: Lifetime
- Fee: **₹2,000**

### Behaviour

- Use large selectable membership cards with radio controls.
- Clearly show the membership name, validity and fee.
- Highlight the selected option using REACH blue.
- The applicant cannot continue without selecting a membership type.

---

## 5. Personal Information

Keep the field order and numbering exactly as follows.

### 1. Photo

- Required document upload.
- Allow JPG, JPEG and PNG.
- Show an image preview after selection.
- Allow the applicant to replace or remove the selected photo.

### 2. Name

- Required text field.
- This field is automatically filled from the uploaded Aadhaar card when OCR extraction is successful.
- The applicant may review and correct the extracted name.

### 3. Father’s Name

- Required text field.

### 4. House Name

- Required text field.

### 5. Place

- Required text field.

### 6. Post Office

- Required text field.

### 7. Panchayath/Municipality

- Required text field or searchable dropdown.

### 8. Blood Group

- Required dropdown.
- Options: A+, A−, B+, B−, AB+, AB−, O+ and O−.

### 9. Date of Birth

- Required date field.
- Do not allow a future date.

### 10. Aadhaar Card Number

The **Aadhaar Card Upload** control must appear immediately before the Aadhaar Card Number field.

#### Aadhaar Card Upload

- Required document upload.
- Allow PDF, JPG, JPEG and PNG.
- After upload, run OCR/document extraction.
- Automatically extract and fill:
  - Applicant name into field **2. Name**.
  - Aadhaar number into field **10. Aadhaar Card Number**.
- Show an extraction/loading state while processing.
- Show a success message after values are extracted.
- If extraction fails, show a clear error and allow manual entry.
- The applicant must be able to review and correct all extracted values.
- Store the uploaded Aadhaar document securely.

#### Aadhaar Card Number Field

- Required field.
- Autofilled from the Aadhaar upload when extraction succeeds.
- Allow manual correction.
- Accept exactly 12 digits.
- Display in a readable format such as `XXXX XXXX XXXX`.
- Save only the digits in the database.
- Mask the number in lists and review screens, for example `XXXX XXXX 1234`.

### 11. Qualification

- Required text field or configurable dropdown.

### 12. Expat

- Required YES/NO selection.
- Selecting **YES** displays section **A) Yes (Expat)**.
- Selecting **NO** displays section **B) No (Retired)**.
- Hide irrelevant conditional fields.
- If the answer changes, warn the applicant before clearing previously entered conditional information.

---

## 6. A) Yes (Expat)

Display this section only when **12. Expat = YES**.

The **ID Card Upload** control must appear immediately before field **4. ID Card Number (Abroad)**. Do not display this upload for retired applicants.

### 1. Phone Number (Abroad)

- Required international phone field.
- Include country code selection.

### 2. WhatsApp Number

- Required international phone field.
- Include a “Same as phone number” checkbox.

### 3. E-mail ID

- Required email field.
- Validate the email format.

### ID Card Upload

- Required for Expat applicants only.
- Allow PDF, JPG, JPEG and PNG.
- Accept the applicant’s foreign residence ID, work permit or national ID.
- After upload, run OCR/document extraction.
- Automatically extract and fill field **4. ID Card Number (Abroad)**.
- Show processing, success and failure states.
- Allow the extracted number to be reviewed and corrected manually.
- Keep this upload completely hidden when **Expat = NO**.

### 4. ID Card Number (Abroad)

- Required for Expat applicants.
- Autofilled from the uploaded ID card when extraction succeeds.
- Allow manual correction.
- Mask the number when displayed outside the edit form.

### 5. Current Job

- Required text field.

### 6. Working Country

- Required searchable country dropdown.

### 7. City

- Required text field.

### 8. Total Years of Working in Abroad

- Required numeric field.
- Minimum value: 0.
- Do not allow negative values.

### 9. Immediate Friend/Family Details

#### A) Name

- Required text field.

#### B) Phone Number

- Required international phone field.
- Include country code selection.

---

## 7. B) No (Retired)

Display this section only when **12. Expat = NO**.

### 1. Retired Year

- Required year field.
- Do not allow a future year.

### 2. Phone Number (India)

- Required Indian phone field.
- Default country code: +91.

### 3. WhatsApp Number

- Required phone field.
- Include a “Same as phone number” checkbox.

### 4. E-mail ID

- Required email field.
- Validate the email format.

### 5. Current Job

- Required text field.
- Allow values such as Retired, Business, Consultant or another current occupation.

### 6. Total Years Worked in Abroad

- Required numeric field.
- Minimum value: 0.
- Do not allow negative values.

### 7. Immediate Friend/Family Details

#### A) Name

- Required text field.

#### B) Phone Number

- Required phone field.
- Default country code: +91, with the option to change it.

---

## 8. Review and Submission

Before submission, display a structured summary containing:

- Selected membership type, validity and fee.
- Personal information.
- Masked Aadhaar card number.
- Expat status.
- Expat or retired information, depending on the selected status.
- Uploaded photo and document status.
- Masked foreign ID card number for Expat applicants.

The applicant must:

- Be able to return to any section and edit information.
- Confirm that the supplied information is correct.
- Accept the membership terms and privacy policy.
- Click **Submit Application**.

After submission, show:

- A success confirmation.
- A unique application reference number.
- The selected membership type and fee.
- Application status: **Pending Verification**.
- An option to download or print the acknowledgement.

---

## 9. OCR and Document Extraction Rules

### Aadhaar Card Extraction

1. Applicant uploads the Aadhaar card immediately before entering the Aadhaar number.
2. The system securely sends the document for OCR.
3. OCR identifies the applicant’s name and 12-digit Aadhaar number.
4. The system fills **2. Name** and **10. Aadhaar Card Number**.
5. Extracted fields are visually marked as “Autofilled from Aadhaar.”
6. The applicant reviews and corrects the values if required.

### Foreign ID Card Extraction

1. The upload is displayed only when **Expat = YES**.
2. The applicant uploads the foreign ID card immediately before the foreign ID number field.
3. OCR extracts the ID card number.
4. The system fills **4. ID Card Number (Abroad)**.
5. The applicant reviews and corrects the value if required.

### Extraction Failure

- Do not block registration permanently when OCR fails.
- Display: “We could not read this document. Please upload a clearer copy or enter the details manually.”
- Provide **Try Again** and **Enter Manually** actions.
- The document must still be available to the administrator for manual verification.

---

## 10. Document Upload Summary

| Document | Placement | Required For | OCR Autofill |
| --- | --- | --- | --- |
| Photo | Field 1 | All applicants | No |
| Aadhaar Card | Immediately before field 10 | All applicants | Name and Aadhaar number |
| ID Card (Abroad) | Immediately before Expat field 4 | Expat applicants only | Foreign ID card number |

---

## 11. Validation and Security

- Validate required fields before proceeding to the next section.
- Clearly mark incomplete or invalid fields.
- Validate all phone numbers according to the selected country code.
- Validate email addresses.
- Restrict file types and file sizes.
- Scan uploaded documents for unsafe files.
- Encrypt sensitive data in transit and at rest.
- Restrict Aadhaar and foreign ID access to authorised administrators.
- Mask identity numbers in tables, reports, logs and review screens.
- Record document upload and verification actions in an audit log.
- Obtain applicant consent before processing identity documents.
- Do not use Aadhaar or foreign ID details for any unrelated purpose.

---

## 12. Administrator Workflow

1. Applicant submits the registration.
2. Application appears under **Pending Approvals**.
3. Administrator opens the application.
4. Administrator compares OCR values with the uploaded documents.
5. Administrator can approve, reject or request corrections.
6. On approval, the system generates a unique membership ID.
7. Membership validity is assigned according to the selected plan.
8. Payment status and verification status are recorded separately.
9. The system generates the membership card after approval and payment confirmation.

### Suggested Application Statuses

- Draft
- Submitted
- Pending Verification
- Correction Requested
- Approved
- Rejected
- Payment Pending
- Active
- Expired

---

## 13. Suggested Database Sections

- Membership plan
- Personal information
- Address information
- Aadhaar information
- Expat status
- Expat details
- Retired details
- Emergency contact details
- Uploaded documents
- OCR extraction result
- Payment information
- Verification and approval history
- Membership validity

Sensitive identity values should be encrypted and separated from general member profile data wherever practical.
