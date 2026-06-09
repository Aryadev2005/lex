export interface TestQuery {
  id: string;
  query: string;
  category: string;
  expected_context: string;
  expected_keywords: string[];
}

export const TEST_QUERIES: TestQuery[] = [
  // ── Supreme Court constitutional questions (q001–q010) ──────────────────

  {
    id: 'q001',
    query: 'What is the test for reasonable classification under Article 14?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on Article 14 equality doctrine',
    expected_keywords: ['Article 14', 'reasonable classification', 'intelligible differentia', 'nexus', 'equality'],
  },
  {
    id: 'q002',
    query: 'When can a writ of mandamus be issued against a private body?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on writ jurisdiction under Article 32 and 226',
    expected_keywords: ['mandamus', 'private body', 'public duty', 'Article 226', 'writ'],
  },
  {
    id: 'q003',
    query: 'What is the basic structure doctrine and which constitutional amendments have been struck down under it?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on basic structure — Kesavananda Bharati and subsequent cases',
    expected_keywords: ['basic structure', 'Kesavananda Bharati', 'constitutional amendment', 'Article 368', 'Parliament'],
  },
  {
    id: 'q004',
    query: 'What is the scope of judicial review under Article 32 of the Indian Constitution?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on Article 32 fundamental rights enforcement',
    expected_keywords: ['Article 32', 'judicial review', 'fundamental rights', 'Supreme Court', 'enforcement'],
  },
  {
    id: 'q005',
    query: 'When does freedom of speech under Article 19(1)(a) yield to reasonable restrictions?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on Article 19(1)(a) and Article 19(2) restrictions',
    expected_keywords: ['Article 19', 'freedom of speech', 'reasonable restrictions', 'sovereignty', 'public order'],
  },
  {
    id: 'q006',
    query: 'What is the constitutional status of the right to privacy in India after Puttaswamy?',
    category: 'constitutional',
    expected_context: 'Supreme Court nine-judge bench judgment in K.S. Puttaswamy v Union of India',
    expected_keywords: ['right to privacy', 'Puttaswamy', 'fundamental right', 'Article 21', 'dignity'],
  },
  {
    id: 'q007',
    query: 'What is the doctrine of eclipse in Indian constitutional law?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on pre-Constitution laws and Article 13',
    expected_keywords: ['doctrine of eclipse', 'Article 13', 'pre-Constitution law', 'void', 'fundamental rights'],
  },
  {
    id: 'q008',
    query: 'On what grounds can President\'s Rule under Article 356 be challenged in court?',
    category: 'constitutional',
    expected_context: "Supreme Court judgment in S.R. Bommai v Union of India on Article 356",
    expected_keywords: ['Article 356', 'President\'s Rule', 'S.R. Bommai', 'constitutional machinery', 'judicial review'],
  },
  {
    id: 'q009',
    query: 'What is the principle of separation of powers under the Indian Constitution?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on separation of powers and checks and balances',
    expected_keywords: ['separation of powers', 'legislature', 'executive', 'judiciary', 'checks and balances'],
  },
  {
    id: 'q010',
    query: 'What is the extent of parliamentary privilege under Articles 105 and 194 and can courts examine it?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on parliamentary privilege and judicial scrutiny',
    expected_keywords: ['parliamentary privilege', 'Article 105', 'Article 194', 'immunity', 'speech and vote'],
  },

  // ── Criminal law — IPC, CrPC, bail (q011–q018) ─────────────────────────

  {
    id: 'q011',
    query: 'What are the conditions for bail in an NDPS Act case involving commercial quantity?',
    category: 'criminal',
    expected_context: 'Supreme Court and High Court judgments on bail under Section 37 NDPS Act',
    expected_keywords: ['NDPS Act', 'Section 37', 'commercial quantity', 'bail', 'reasonable grounds'],
  },
  {
    id: 'q012',
    query: 'What does "beyond reasonable doubt" mean in Indian criminal law?',
    category: 'criminal',
    expected_context: 'Supreme Court judgments on standard of proof in criminal trials',
    expected_keywords: ['beyond reasonable doubt', 'standard of proof', 'prosecution', 'criminal trial', 'acquittal'],
  },
  {
    id: 'q013',
    query: 'What is the distinction between murder under Section 302 IPC and culpable homicide not amounting to murder under Section 304 IPC?',
    category: 'criminal',
    expected_context: 'Supreme Court judgments distinguishing Sections 300, 302 and 304 IPC',
    expected_keywords: ['Section 302', 'Section 304', 'culpable homicide', 'murder', 'intention', 'knowledge'],
  },
  {
    id: 'q014',
    query: 'What are the essential ingredients of the offence of cheating under Section 420 IPC?',
    category: 'criminal',
    expected_context: 'Supreme Court judgments on elements of cheating and fraud under IPC',
    expected_keywords: ['Section 420', 'cheating', 'dishonestly', 'deceive', 'fraudulent', 'delivery of property'],
  },
  {
    id: 'q015',
    query: 'What is the procedure for filing a charge sheet under Section 173 CrPC and what happens if it is not filed within 90 days?',
    category: 'criminal',
    expected_context: 'Supreme Court and High Court judgments on Section 173 CrPC and default bail',
    expected_keywords: ['Section 173', 'charge sheet', '90 days', 'default bail', 'CrPC', 'police report'],
  },
  {
    id: 'q016',
    query: 'When can anticipatory bail be granted under Section 438 CrPC and what are the relevant considerations?',
    category: 'criminal',
    expected_context: 'Supreme Court judgments on Section 438 CrPC anticipatory bail jurisprudence',
    expected_keywords: ['Section 438', 'anticipatory bail', 'apprehension of arrest', 'conditions', 'CrPC'],
  },
  {
    id: 'q017',
    query: 'What constitutes cruelty under Section 498A IPC and how has the Supreme Court interpreted it?',
    category: 'criminal',
    expected_context: 'Supreme Court judgments on Section 498A IPC matrimonial cruelty',
    expected_keywords: ['Section 498A', 'cruelty', 'harassment', 'dowry', 'matrimonial', 'mental cruelty'],
  },
  {
    id: 'q018',
    query: 'What constitutes abetment of suicide under Section 306 IPC and what is the required mens rea?',
    category: 'criminal',
    expected_context: 'Supreme Court judgments on Section 306 IPC and instigation to suicide',
    expected_keywords: ['Section 306', 'abetment of suicide', 'instigation', 'mens rea', 'proximate cause'],
  },

  // ── Contract and commercial (q019–q024) ────────────────────────────────

  {
    id: 'q019',
    query: 'What constitutes anticipatory breach of contract under Indian law?',
    category: 'contract',
    expected_context: 'Supreme Court judgments and commentary on Section 39 Indian Contract Act',
    expected_keywords: ['anticipatory breach', 'Section 39', 'Contract Act', 'refusal', 'rescind'],
  },
  {
    id: 'q020',
    query: 'What is the doctrine of frustration of contract under Section 56 of the Indian Contract Act?',
    category: 'contract',
    expected_context: 'Supreme Court judgments on Section 56 Indian Contract Act and frustration',
    expected_keywords: ['frustration', 'Section 56', 'impossible', 'supervening impossibility', 'Contract Act'],
  },
  {
    id: 'q021',
    query: 'What are the conditions for specific performance of a contract under the Specific Relief Act 1963?',
    category: 'contract',
    expected_context: 'Supreme Court judgments on Specific Relief Act and when courts grant specific performance',
    expected_keywords: ['specific performance', 'Specific Relief Act', 'discretion', 'damages', 'adequate remedy'],
  },
  {
    id: 'q022',
    query: 'What is the difference between a contract of indemnity and a contract of guarantee under the Indian Contract Act?',
    category: 'contract',
    expected_context: 'Supreme Court judgments and principles on indemnity and guarantee under Contract Act',
    expected_keywords: ['indemnity', 'guarantee', 'surety', 'principal debtor', 'Section 124', 'Section 126'],
  },
  {
    id: 'q023',
    query: 'When is a contract voidable for misrepresentation under the Indian Contract Act?',
    category: 'contract',
    expected_context: 'Supreme Court judgments on misrepresentation under Sections 18 and 19 Contract Act',
    expected_keywords: ['misrepresentation', 'voidable', 'Section 18', 'Section 19', 'consent', 'Contract Act'],
  },
  {
    id: 'q024',
    query: 'What constitutes a valid acceptance of an offer under the Indian Contract Act and when does acceptance become complete?',
    category: 'contract',
    expected_context: 'Supreme Court judgments on offer and acceptance under Sections 2 and 4 Contract Act',
    expected_keywords: ['acceptance', 'offer', 'Section 4', 'communication', 'postal rule', 'Contract Act'],
  },

  // ── Property law (q025–q030) ────────────────────────────────────────────

  {
    id: 'q025',
    query: 'What is the limitation period for a suit for recovery of possession of immovable property?',
    category: 'property',
    expected_context: 'Supreme Court judgments on Articles 64–65 Limitation Act 1963 and possession suits',
    expected_keywords: ['limitation period', 'recovery of possession', 'Article 65', 'Limitation Act', '12 years'],
  },
  {
    id: 'q026',
    query: 'What is the doctrine of part performance under Section 53A of the Transfer of Property Act?',
    category: 'property',
    expected_context: 'Supreme Court judgments on Section 53A TPA and equitable doctrine of part performance',
    expected_keywords: ['part performance', 'Section 53A', 'Transfer of Property Act', 'possession', 'agreement'],
  },
  {
    id: 'q027',
    query: 'What constitutes adverse possession of immovable property in India and what must be proved?',
    category: 'property',
    expected_context: 'Supreme Court judgments on adverse possession — nec vi nec clam nec precario',
    expected_keywords: ['adverse possession', 'animus possidendi', 'hostile', 'open', 'continuous', 'Limitation Act'],
  },
  {
    id: 'q028',
    query: 'What is the difference between a simple mortgage and a mortgage by deposit of title deeds under the TPA?',
    category: 'property',
    expected_context: 'Supreme Court judgments on mortgage modes under Transfer of Property Act',
    expected_keywords: ['simple mortgage', 'equitable mortgage', 'title deeds', 'Section 58', 'Transfer of Property Act'],
  },
  {
    id: 'q029',
    query: 'What are the rights and obligations of a lessee and lessor under a lease under the Transfer of Property Act?',
    category: 'property',
    expected_context: 'Supreme Court judgments on lease rights under Sections 105–117 Transfer of Property Act',
    expected_keywords: ['lease', 'lessee', 'lessor', 'Section 108', 'Transfer of Property Act', 'quiet possession'],
  },
  {
    id: 'q030',
    query: 'What is the rule against perpetuities under Section 14 of the Transfer of Property Act?',
    category: 'property',
    expected_context: 'Supreme Court judgments on future interests and rule against perpetuities under TPA',
    expected_keywords: ['rule against perpetuities', 'Section 14', 'Transfer of Property Act', 'future interest', 'vesting'],
  },

  // ── Company law — NCLT and IBC (q031–q035) ─────────────────────────────

  {
    id: 'q031',
    query: 'What is the moratorium period under Section 14 of IBC 2016 and what transactions are prohibited during it?',
    category: 'company',
    expected_context: 'NCLT/NCLAT judgments and Supreme Court rulings on moratorium under IBC 2016',
    expected_keywords: ['moratorium', 'Section 14', 'IBC', 'CIRP', 'prohibited', 'corporate debtor'],
  },
  {
    id: 'q032',
    query: 'What is the role and powers of the resolution professional during the Corporate Insolvency Resolution Process?',
    category: 'company',
    expected_context: 'NCLT judgments and IBC provisions on resolution professional duties',
    expected_keywords: ['resolution professional', 'CIRP', 'IBC', 'committee of creditors', 'management', 'insolvency'],
  },
  {
    id: 'q033',
    query: 'When can a financial creditor initiate insolvency proceedings under Section 7 of the IBC and what is the threshold?',
    category: 'company',
    expected_context: 'NCLT and Supreme Court judgments on Section 7 IBC applications by financial creditors',
    expected_keywords: ['financial creditor', 'Section 7', 'IBC', 'default', 'one crore', 'debt', 'insolvency'],
  },
  {
    id: 'q034',
    query: 'What is the waterfall mechanism for distribution of proceeds under Section 53 of IBC 2016?',
    category: 'company',
    expected_context: 'Supreme Court and NCLAT judgments on Section 53 IBC priority of distribution',
    expected_keywords: ['Section 53', 'waterfall', 'IBC', 'liquidation', 'priority', 'secured creditor', 'distribution'],
  },
  {
    id: 'q035',
    query: 'What are the grounds for disqualification of directors under Section 164 of the Companies Act 2013?',
    category: 'company',
    expected_context: 'NCLT and High Court judgments on director disqualification under Companies Act 2013',
    expected_keywords: ['Section 164', 'director disqualification', 'Companies Act', 'annual returns', 'insolvent'],
  },

  // ── Family law (q036–q040) ──────────────────────────────────────────────

  {
    id: 'q036',
    query: 'What is the test for cruelty as a ground for divorce under Hindu law?',
    category: 'family',
    expected_context: 'Supreme Court judgments on cruelty under Section 13(1)(ia) Hindu Marriage Act 1955',
    expected_keywords: ['cruelty', 'Section 13', 'Hindu Marriage Act', 'mental cruelty', 'reasonable apprehension'],
  },
  {
    id: 'q037',
    query: 'What is the legal position on irretrievable breakdown of marriage as a ground for divorce in India?',
    category: 'family',
    expected_context: 'Supreme Court judgments on irretrievable breakdown and Article 142 jurisdiction',
    expected_keywords: ['irretrievable breakdown', 'Article 142', 'divorce', 'Hindu Marriage Act', 'Supreme Court'],
  },
  {
    id: 'q038',
    query: 'What are the maintenance rights of a Muslim wife under Section 125 CrPC after the Shah Bano judgment?',
    category: 'family',
    expected_context: 'Supreme Court judgment in Shah Bano and subsequent developments under Section 125 CrPC',
    expected_keywords: ['Section 125', 'maintenance', 'Muslim wife', 'Shah Bano', 'iddat', 'CrPC'],
  },
  {
    id: 'q039',
    query: 'What is the legal effect of a marriage registered under the Special Marriage Act 1954?',
    category: 'family',
    expected_context: 'Supreme Court and High Court judgments on Special Marriage Act civil marriage effects',
    expected_keywords: ['Special Marriage Act', 'civil marriage', 'registration', 'succession', 'Hindu law'],
  },
  {
    id: 'q040',
    query: 'What are the rights of an adopted child to inheritance under the Hindu Adoptions and Maintenance Act 1956?',
    category: 'family',
    expected_context: 'Supreme Court judgments on adoption and inheritance under HAMA 1956',
    expected_keywords: ['adopted child', 'Hindu Adoptions', 'HAMA', 'inheritance', 'succession', 'Section 12'],
  },

  // ── Tax law (q041–q044) ─────────────────────────────────────────────────

  {
    id: 'q041',
    query: 'What is the difference between tax evasion and tax avoidance in India and what is the GAAR doctrine?',
    category: 'tax',
    expected_context: 'Supreme Court and ITAT judgments on tax avoidance, evasion and General Anti-Avoidance Rule',
    expected_keywords: ['tax evasion', 'tax avoidance', 'GAAR', 'Income Tax Act', 'impermissible arrangement'],
  },
  {
    id: 'q042',
    query: 'What are the conditions for deduction of TDS under Section 194C of the Income Tax Act for contractor payments?',
    category: 'tax',
    expected_context: 'ITAT and High Court judgments on TDS deduction under Section 194C Income Tax Act',
    expected_keywords: ['Section 194C', 'TDS', 'contractor', 'sub-contractor', 'Income Tax Act', 'deduction'],
  },
  {
    id: 'q043',
    query: 'What is the doctrine of substance over form in Indian tax law?',
    category: 'tax',
    expected_context: 'Supreme Court judgments on substance over form and sham transactions in tax',
    expected_keywords: ['substance over form', 'sham transaction', 'tax', 'Income Tax Act', 'colourable device'],
  },
  {
    id: 'q044',
    query: 'What is the scope of Input Tax Credit under GST and when can it be denied?',
    category: 'tax',
    expected_context: 'High Court and AAR rulings on ITC under Section 16 of CGST Act',
    expected_keywords: ['Input Tax Credit', 'ITC', 'CGST', 'Section 16', 'GST', 'blocked credit'],
  },

  // ── High Court jurisdiction (q045–q047) ────────────────────────────────

  {
    id: 'q045',
    query: 'What is the territorial jurisdiction of the Bombay High Court and which districts fall under it?',
    category: 'hc_jurisdiction',
    expected_context: 'Bombay High Court judgments and Letters Patent on territorial jurisdiction',
    expected_keywords: ['Bombay High Court', 'territorial jurisdiction', 'Maharashtra', 'Letters Patent', 'Goa'],
  },
  {
    id: 'q046',
    query: 'What is the scope of writ jurisdiction of High Courts under Article 226 and can it be exercised against private parties?',
    category: 'hc_jurisdiction',
    expected_context: 'Supreme Court judgments on Article 226 writ jurisdiction scope and private parties',
    expected_keywords: ['Article 226', 'writ jurisdiction', 'High Court', 'private party', 'public law', 'certiorari'],
  },
  {
    id: 'q047',
    query: 'What is the inherent power of the High Court under Section 482 CrPC and when is it exercised to quash FIRs?',
    category: 'hc_jurisdiction',
    expected_context: 'Supreme Court judgments on Section 482 CrPC and quashing of FIRs and proceedings',
    expected_keywords: ['Section 482', 'CrPC', 'inherent power', 'quash', 'FIR', 'abuse of process'],
  },

  // ── Procedural (q048–q050) ──────────────────────────────────────────────

  {
    id: 'q048',
    query: 'What is Order 39 Rule 1 CPC and what must a plaintiff establish to obtain a temporary injunction?',
    category: 'procedural',
    expected_context: 'Supreme Court judgments on three-pronged test for temporary injunctions under CPC',
    expected_keywords: ['Order 39 Rule 1', 'temporary injunction', 'prima facie case', 'balance of convenience', 'irreparable injury'],
  },
  {
    id: 'q049',
    query: 'What is Section 5 of the Limitation Act and what must be shown for condonation of delay?',
    category: 'procedural',
    expected_context: 'Supreme Court judgments on Section 5 Limitation Act and sufficient cause for delay',
    expected_keywords: ['Section 5', 'Limitation Act', 'condonation of delay', 'sufficient cause', 'bona fide'],
  },
  {
    id: 'q050',
    query: 'What is the inherent jurisdiction of civil courts under Section 151 CPC and what are its limits?',
    category: 'procedural',
    expected_context: 'Supreme Court judgments on Section 151 CPC inherent powers and their limitations',
    expected_keywords: ['Section 151', 'CPC', 'inherent powers', 'ends of justice', 'abuse of process', 'express provision'],
  },
];
