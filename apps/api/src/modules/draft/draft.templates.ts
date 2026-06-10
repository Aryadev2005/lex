export interface DraftSlot {
  name: string;
  label: string;
  description: string;
  required: boolean;
}

export interface DraftTemplate {
  id: string;
  name: string;
  description: string;
  document_type: string;
  court_type: string | null;
  jurisdiction: string | null;
  slots: DraftSlot[];
  structure: string;
}

export const DRAFT_TEMPLATES: DraftTemplate[] = [
  {
    id: 'legal_notice_general',
    name: 'Legal Notice (General)',
    description:
      'A formal legal notice sent through an advocate demanding action or relief from the recipient.',
    document_type: 'legal_notice',
    court_type: null,
    jurisdiction: null,
    slots: [
      { name: 'sender_name', label: 'Sender Name', description: 'Full legal name of the person sending the notice', required: true },
      { name: 'sender_address', label: 'Sender Address', description: 'Complete postal address of the sender', required: true },
      { name: 'recipient_name', label: 'Recipient Name', description: 'Full legal name of the person or entity receiving the notice', required: true },
      { name: 'recipient_address', label: 'Recipient Address', description: 'Complete postal address of the recipient', required: true },
      { name: 'subject_matter', label: 'Subject Matter', description: 'Brief description of the legal dispute or issue (e.g., recovery of dues, property dispute)', required: true },
      { name: 'grievance_details', label: 'Grievance Details', description: 'Detailed facts of the dispute including dates, amounts, and specific incidents', required: true },
      { name: 'relief_demanded', label: 'Relief Demanded', description: 'Specific action or payment demanded from the recipient', required: true },
      { name: 'time_limit_days', label: 'Time Limit (Days)', description: 'Number of days given to comply with the notice (typically 15 or 30)', required: true },
      { name: 'advocate_name', label: 'Advocate Name', description: 'Full name of the advocate issuing the notice', required: true },
      { name: 'date', label: 'Date', description: 'Date of issuing the notice (DD/MM/YYYY)', required: true },
    ],
    structure: `TO,
{{recipient_name}}
{{recipient_address}}

From:
{{sender_name}}
{{sender_address}}

DATE: {{date}}

SUBJECT: LEGAL NOTICE – {{subject_matter}}

Sir/Madam,

Under instructions from and on behalf of my client, {{sender_name}}, residing at {{sender_address}}, I do hereby serve upon you the following legal notice:

1. That my client, {{sender_name}}, is a person well-known to you and the facts and circumstances herein are within your personal knowledge.

2. That {{grievance_details}}

3. That despite repeated requests, communications and reminders, you have wilfully failed, neglected and refused to redress the grievance of my client, causing grave loss and injury.

4. That you are, therefore, hereby called upon to {{relief_demanded}} within {{time_limit_days}} days from the date of receipt of this notice, failing which my client shall be constrained to initiate all such legal proceedings — both civil and criminal — as may be available under law, entirely at your risk, costs and consequences.

5. That this notice is being issued without prejudice to any other rights or remedies that my client may have under law.

Take notice that this letter shall form part of evidence in any legal proceedings that may ensue.

Yours faithfully,

{{advocate_name}}
Advocate
`,
  },
  {
    id: 'vakalatnama_hc',
    name: 'Vakalatnama (High Court)',
    description:
      'A formal authority letter appointing an advocate to represent a party before the High Court.',
    document_type: 'vakalatnama',
    court_type: 'high_court',
    jurisdiction: null,
    slots: [
      { name: 'court_name', label: 'Court Name', description: 'Full name of the High Court (e.g., High Court of Judicature at Bombay)', required: true },
      { name: 'case_number', label: 'Case Number', description: 'Case number assigned by the court registry', required: true },
      { name: 'case_type', label: 'Case Type', description: 'Type of case (e.g., Writ Petition, Civil Appeal, Criminal Appeal)', required: true },
      { name: 'petitioner_name', label: 'Petitioner Name', description: 'Full legal name of the petitioner or appellant', required: true },
      { name: 'respondent_name', label: 'Respondent Name', description: 'Full legal name of the respondent', required: true },
      { name: 'advocate_name', label: 'Advocate Name', description: 'Full name of the appointed advocate', required: true },
      { name: 'advocate_enrollment', label: 'Advocate Enrollment Number', description: 'Bar Council enrollment number of the advocate', required: true },
      { name: 'client_name', label: 'Client Name', description: 'Full name of the client executing the vakalatnama', required: true },
      { name: 'date', label: 'Date', description: 'Date of execution of the vakalatnama (DD/MM/YYYY)', required: true },
    ],
    structure: `IN THE HIGH COURT OF {{court_name}}

Case No.: {{case_number}}
Case Type: {{case_type}}

{{petitioner_name}}
                                       ...Petitioner/Appellant

VERSUS

{{respondent_name}}
                                       ...Respondent

VAKALATNAMA

KNOW ALL MEN BY THESE PRESENTS that I/We, {{client_name}}, the Petitioner/Appellant/Respondent in the above-captioned matter, do hereby appoint, retain and authorise {{advocate_name}}, Advocate, Enrolment No. {{advocate_enrollment}}, to act, appear and plead for me/us in the above-mentioned case and all proceedings connected therewith, including before any superior court as may be necessary.

AND I/We hereby grant and confer upon the said Advocate full power and authority to do and perform all acts, deeds and things as may be necessary for the proper conduct of the said case, including the power to:

(i)   file and withdraw any petition, application, revision or appeal;
(ii)  examine and cross-examine witnesses on my/our behalf;
(iii) submit, inspect and receive back documents and records;
(iv)  make, sign and verify all plaints, petitions, applications and other documents;
(v)   make settlements, compromises and concessions as may be advised; and
(vi)  take all such steps and measures as may be deemed necessary for the protection of my/our interests.

AND I/We undertake to ratify and confirm all proceedings taken, and all acts done, by the said Advocate in pursuance of this authority.

Signed and executed at _____________ on this {{date}}.

                                       {{client_name}}
                                       Client

Accepted:

{{advocate_name}}
Advocate
Enrolment No.: {{advocate_enrollment}}
`,
  },
  {
    id: 'affidavit_general',
    name: 'Affidavit (General Purpose)',
    description:
      'A sworn statement of facts on solemn affirmation for use in court proceedings or official purposes.',
    document_type: 'affidavit',
    court_type: null,
    jurisdiction: null,
    slots: [
      { name: 'deponent_name', label: 'Deponent Name', description: 'Full legal name of the person making the affidavit', required: true },
      { name: 'deponent_age', label: 'Deponent Age', description: 'Age of the deponent in years', required: true },
      { name: 'deponent_occupation', label: 'Deponent Occupation', description: 'Profession or occupation of the deponent', required: true },
      { name: 'deponent_address', label: 'Deponent Address', description: 'Complete residential address of the deponent', required: true },
      { name: 'court_name', label: 'Court Name', description: 'Name and designation of the court where the affidavit is to be filed', required: true },
      { name: 'case_reference', label: 'Case Reference', description: 'Case number or reference for which the affidavit is being filed', required: true },
      { name: 'statement_facts', label: 'Statement of Facts', description: 'The substantive facts being affirmed — narrated clearly in first person', required: true },
      { name: 'date', label: 'Date', description: 'Date of swearing the affidavit (DD/MM/YYYY)', required: true },
      { name: 'place', label: 'Place', description: 'City or location where the affidavit is sworn', required: true },
    ],
    structure: `IN THE COURT OF {{court_name}}

Case Reference: {{case_reference}}

AFFIDAVIT

I, {{deponent_name}}, aged {{deponent_age}} years, son/daughter of _________________________, by occupation {{deponent_occupation}}, residing at {{deponent_address}}, do hereby solemnly affirm and declare as under:

1. That I am the deponent herein and I am fully competent to swear this affidavit.

2. That I am well acquainted with the facts and circumstances of the above-referenced matter.

3. That {{statement_facts}}

4. That the facts stated in this affidavit are true and correct to the best of my knowledge, information and belief.

5. That no part of this affidavit is false and nothing material has been concealed or suppressed therefrom.

Solemnly affirmed at {{place}} on this {{date}}.

                                       DEPONENT
                                       {{deponent_name}}

VERIFICATION

Verified at {{place}} on this {{date}} that the contents of this affidavit are true and correct to the best of my knowledge and belief, and nothing material has been concealed therefrom.

                                       DEPONENT
                                       {{deponent_name}}

Before me:

_________________________________
Notary Public / Oath Commissioner
`,
  },
  {
    id: 'demand_notice_cheque_bounce',
    name: 'Demand Notice (Cheque Dishonour — Section 138 NI Act)',
    description:
      'Statutory demand notice under Section 138 of the Negotiable Instruments Act, 1881, for dishonoured cheques.',
    document_type: 'demand_notice',
    court_type: null,
    jurisdiction: null,
    slots: [
      { name: 'drawer_name', label: 'Drawer Name', description: 'Full legal name of the person who issued the cheque', required: true },
      { name: 'drawer_address', label: 'Drawer Address', description: 'Complete postal address of the cheque drawer', required: true },
      { name: 'payee_name', label: 'Payee Name', description: 'Full legal name of the payee (the client who received the cheque)', required: true },
      { name: 'cheque_number', label: 'Cheque Number', description: 'Cheque number as printed on the cheque', required: true },
      { name: 'cheque_date', label: 'Cheque Date', description: 'Date mentioned on the face of the cheque (DD/MM/YYYY)', required: true },
      { name: 'cheque_amount', label: 'Cheque Amount', description: 'Amount in figures for which the cheque was drawn', required: true },
      { name: 'bank_name', label: 'Bank Name', description: 'Full name and branch of the bank on which the cheque was drawn', required: true },
      { name: 'dishonour_date', label: 'Dishonour Date', description: 'Date on which the cheque was returned/dishonoured (DD/MM/YYYY)', required: true },
      { name: 'dishonour_reason', label: 'Dishonour Reason', description: 'Reason stated by the bank for dishonour (e.g., Insufficient Funds, Payment Stopped by Drawer)', required: true },
      { name: 'advocate_name', label: 'Advocate Name', description: 'Full name of the advocate issuing this notice', required: true },
      { name: 'date', label: 'Date', description: 'Date of issuing this notice (DD/MM/YYYY)', required: true },
    ],
    structure: `To,
{{drawer_name}}
{{drawer_address}}

DATE: {{date}}

NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881

Sir/Madam,

Under instructions from and on behalf of my client, {{payee_name}}, I hereby serve upon you the following statutory demand notice:

1. That my client, {{payee_name}}, received a cheque bearing No. {{cheque_number}}, dated {{cheque_date}}, for a sum of Rs. {{cheque_amount}}/- (Rupees __________________________ only), drawn on {{bank_name}}, purportedly issued by you towards discharge of a legally enforceable debt/liability.

2. That the said cheque was duly presented for encashment through my client's banker and was returned/dishonoured on {{dishonour_date}} with the endorsement "{{dishonour_reason}}", as is evidenced by the bank's memo.

3. That the dishonour of the said cheque constitutes an offence under Section 138 of the Negotiable Instruments Act, 1881, which is punishable with imprisonment up to two years or with fine up to twice the cheque amount, or with both.

4. That you are hereby called upon to make good the payment of the aforesaid amount of Rs. {{cheque_amount}}/- (Rupees __________________________ only) to my client within FIFTEEN (15) days from the date of receipt of this notice.

5. That if you fail and neglect to make the aforesaid payment within the stipulated period, my client shall be constrained to initiate criminal complaint proceedings against you under Section 138 read with Section 142 of the Negotiable Instruments Act, 1881, as also any civil proceedings for recovery of the said amount with interest and costs, entirely at your risk and consequences.

Take Notice Accordingly.

Yours faithfully,

{{advocate_name}}
Advocate
`,
  },
  {
    id: 'bail_application',
    name: 'Bail Application (Sessions Court)',
    description:
      'Formal bail application under Section 437/439 CrPC for filing before a Sessions Court.',
    document_type: 'bail_application',
    court_type: 'sessions_court',
    jurisdiction: null,
    slots: [
      { name: 'court_name', label: 'Court Name', description: 'Full designation of the Sessions Court (e.g., Sessions Court, Mumbai)', required: true },
      { name: 'case_number', label: 'Case Number', description: 'Sessions case number or criminal case number', required: true },
      { name: 'fir_number', label: 'FIR Number', description: 'First Information Report number', required: true },
      { name: 'police_station', label: 'Police Station', description: 'Name of the police station that registered the FIR', required: true },
      { name: 'accused_name', label: 'Accused Name', description: 'Full legal name of the accused/applicant', required: true },
      { name: 'accused_address', label: 'Accused Address', description: 'Complete residential address of the accused', required: true },
      { name: 'offence_section', label: 'Offence Section', description: 'IPC/special law sections under which the accused is charged', required: true },
      { name: 'arrest_date', label: 'Arrest Date', description: 'Date on which the accused was arrested (DD/MM/YYYY)', required: true },
      { name: 'grounds_for_bail', label: 'Grounds for Bail', description: 'Specific legal and factual grounds why bail should be granted (false implication, no prior antecedents, cooperation with investigation, etc.)', required: true },
      { name: 'surety_details', label: 'Surety Details', description: 'Name, address and relationship of proposed surety', required: true },
      { name: 'advocate_name', label: 'Advocate Name', description: 'Full name of the advocate filing the bail application', required: true },
      { name: 'date', label: 'Date', description: 'Date of filing this application (DD/MM/YYYY)', required: true },
    ],
    structure: `IN THE COURT OF {{court_name}}

Case No.: {{case_number}}
FIR No.: {{fir_number}}
Police Station: {{police_station}}

IN THE MATTER OF:

STATE
                                       ...Complainant

VERSUS

{{accused_name}}
{{accused_address}}
                                       ...Applicant/Accused

APPLICATION FOR BAIL UNDER SECTION 437/439 OF THE CODE OF CRIMINAL PROCEDURE, 1973

MOST RESPECTFULLY SHEWETH:

1. That the Applicant, {{accused_name}}, has been arrested by {{police_station}} on {{arrest_date}} in connection with FIR No. {{fir_number}} for offences alleged to be punishable under Section(s) {{offence_section}} of the Indian Penal Code / relevant special legislation.

2. That the Applicant is innocent and has been falsely and wrongfully implicated in the present case. The Applicant denies all the allegations levelled against him/her.

3. That {{grounds_for_bail}}

4. That the Applicant has deep roots in society, is not likely to flee from justice, and undertakes to abide by all terms and conditions as may be imposed by this Hon'ble Court.

5. That the Applicant shall not tamper with evidence, influence witnesses or obstruct the investigation in any manner, and shall fully cooperate with the investigating agency as and when required.

6. That the Applicant is ready and willing to furnish surety as directed by this Hon'ble Court. Proposed surety: {{surety_details}}.

7. That there is no likelihood of the Applicant repeating the offence and no case for continued detention is made out.

PRAYER

It is, therefore, most respectfully prayed that this Hon'ble Court may graciously be pleased to:

(a) Release the Applicant, {{accused_name}}, on bail on such terms and conditions as this Hon'ble Court may deem fit and proper;

(b) Pass such other and further orders as this Hon'ble Court may deem just and proper in the facts and circumstances of the case.

And for this act of kindness, the Applicant shall as in duty bound, ever pray.

Place: {{court_name}}
Date: {{date}}

                                       {{advocate_name}}
                                       Advocate for the Applicant
`,
  },
];
