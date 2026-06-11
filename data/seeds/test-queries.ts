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

  // ── Contract law — drafting issues (q051–q060) ──────────────────────────

  {
    id: 'q051',
    query: 'Are limitation of liability clauses in commercial contracts enforceable under Indian law?',
    category: 'contract',
    expected_context: 'Supreme Court and High Court judgments on enforceability of limitation of liability clauses under Indian Contract Act',
    expected_keywords: ['limitation of liability', 'Indian Contract Act', 'Section 73', 'exemption clause', 'enforceability', 'unconscionable'],
  },
  {
    id: 'q052',
    query: 'What is the scope and enforceability of indemnity clauses under the Indian Contract Act 1872?',
    category: 'contract',
    expected_context: 'Supreme Court judgments on indemnity obligations under Section 124 and 125 Indian Contract Act',
    expected_keywords: ['indemnity', 'Section 124', 'Section 125', 'Indian Contract Act 1872', 'indemnifier', 'losses'],
  },
  {
    id: 'q053',
    query: 'What is the distinction between a penalty and liquidated damages under Section 74 of the Indian Contract Act?',
    category: 'contract',
    expected_context: 'Supreme Court judgments on Section 74 Indian Contract Act penalty vs genuine pre-estimate of loss',
    expected_keywords: ['Section 74', 'liquidated damages', 'penalty', 'Indian Contract Act', 'genuine pre-estimate', 'reasonable compensation'],
  },
  {
    id: 'q054',
    query: 'Is a termination for convenience clause in a commercial contract valid under Indian law and what compensation is payable?',
    category: 'contract',
    expected_context: 'Supreme Court and High Court judgments on termination for convenience and compensation under Indian Contract Act',
    expected_keywords: ['termination for convenience', 'Indian Contract Act', 'Section 73', 'compensation', 'damages', 'reasonable notice'],
  },
  {
    id: 'q055',
    query: 'How have Indian courts interpreted force majeure clauses in the context of COVID-19 disruptions?',
    category: 'contract',
    expected_context: 'High Court judgments on force majeure under Section 32 and Section 56 Indian Contract Act and COVID-19',
    expected_keywords: ['force majeure', 'COVID-19', 'Section 56', 'frustration', 'Indian Contract Act', 'impossibility'],
  },
  {
    id: 'q056',
    query: 'To what extent can consequential damages be excluded in a commercial contract under Indian law?',
    category: 'contract',
    expected_context: 'Supreme Court and High Court judgments on exclusion of consequential and indirect damages under Contract Act',
    expected_keywords: ['consequential damages', 'exclusion clause', 'Section 73', 'Indian Contract Act', 'indirect loss', 'remoteness'],
  },
  {
    id: 'q057',
    query: 'How do Indian courts resolve conflicts between a governing law clause and mandatory provisions of Indian law?',
    category: 'contract',
    expected_context: 'Supreme Court judgments on governing law clauses and mandatory provisions of Indian law in conflict of laws',
    expected_keywords: ['governing law', 'conflict of laws', 'mandatory provisions', 'Indian Contract Act', 'private international law', 'choice of law'],
  },
  {
    id: 'q058',
    query: 'When can contractual rights be assigned under Indian law and what restrictions apply?',
    category: 'contract',
    expected_context: 'Supreme Court judgments on assignment of contractual rights and obligations under Transfer of Property Act and Contract Act',
    expected_keywords: ['assignment', 'contractual rights', 'Transfer of Property Act', 'consent', 'personal contract', 'novation'],
  },
  {
    id: 'q059',
    query: 'What is the legal effect of a warranty disclaimer clause in a commercial supply agreement under Indian law?',
    category: 'contract',
    expected_context: 'Supreme Court and High Court judgments on warranty disclaimers and implied terms under Indian Sale of Goods Act and Contract Act',
    expected_keywords: ['warranty disclaimer', 'implied warranty', 'Sale of Goods Act', 'Indian Contract Act', 'fitness for purpose', 'exclusion'],
  },
  {
    id: 'q060',
    query: 'What protections do Indian courts extend to parties bound by unfair terms in standard form contracts?',
    category: 'contract',
    expected_context: 'Supreme Court judgments on standard form contracts, unconscionable terms and public policy under Indian Contract Act',
    expected_keywords: ['standard form contract', 'unconscionable terms', 'public policy', 'Indian Contract Act', 'adhesion contract', 'unequal bargaining'],
  },

  // ── Commercial / Corporate (q061–q068) ─────────────────────────────────

  {
    id: 'q061',
    query: 'When will Indian courts lift the corporate veil and hold a parent company or director liable for subsidiary obligations?',
    category: 'corporate',
    expected_context: 'Supreme Court judgments on lifting the corporate veil under Companies Act and common law',
    expected_keywords: ['corporate veil', 'lifting', 'parent company', 'Companies Act', 'alter ego', 'fraud'],
  },
  {
    id: 'q062',
    query: 'What is the duty of care owed by directors under Section 166 of the Companies Act 2013?',
    category: 'corporate',
    expected_context: 'NCLT and High Court judgments on directors\' duties under Section 166 Companies Act 2013',
    expected_keywords: ['Section 166', 'directors duty', 'Companies Act 2013', 'due care', 'diligence', 'fiduciary'],
  },
  {
    id: 'q063',
    query: 'What remedies are available to minority shareholders for oppression and mismanagement under the Companies Act 2013?',
    category: 'corporate',
    expected_context: 'NCLT and NCLAT judgments on minority shareholder oppression under Sections 241-242 Companies Act 2013',
    expected_keywords: ['minority shareholder', 'oppression', 'mismanagement', 'Section 241', 'Section 242', 'Companies Act 2013'],
  },
  {
    id: 'q064',
    query: 'What are pre-emption rights in a shareholders agreement and how are they enforced in India?',
    category: 'corporate',
    expected_context: 'High Court and Supreme Court judgments on pre-emption rights in shareholders agreements',
    expected_keywords: ['pre-emption rights', 'right of first refusal', 'shareholders agreement', 'Companies Act', 'transfer restriction', 'specific performance'],
  },
  {
    id: 'q065',
    query: 'Are drag-along and tag-along rights in shareholders agreements enforceable under Indian corporate law?',
    category: 'corporate',
    expected_context: 'High Court judgments and SEBI regulations on drag-along and tag-along rights in shareholders agreements',
    expected_keywords: ['drag-along', 'tag-along', 'shareholders agreement', 'Companies Act', 'minority rights', 'share transfer'],
  },
  {
    id: 'q066',
    query: 'What representations and warranties are typically given by a seller in a share purchase agreement and what remedies arise for breach?',
    category: 'corporate',
    expected_context: 'High Court judgments on representations warranties and indemnities in share purchase agreements',
    expected_keywords: ['representations', 'warranties', 'share purchase agreement', 'indemnity', 'breach', 'Indian Contract Act'],
  },
  {
    id: 'q067',
    query: 'What constitutes a Material Adverse Change under Indian M&A agreements and how have courts interpreted it?',
    category: 'corporate',
    expected_context: 'Supreme Court and High Court judgments on Material Adverse Change clauses in merger and acquisition agreements',
    expected_keywords: ['material adverse change', 'MAC clause', 'M&A', 'acquisition agreement', 'Indian Contract Act', 'termination'],
  },
  {
    id: 'q068',
    query: 'Are non-compete and non-solicitation clauses in employment and business sale agreements enforceable under Indian law?',
    category: 'corporate',
    expected_context: 'Supreme Court judgments on restraint of trade and Section 27 Indian Contract Act',
    expected_keywords: ['non-compete', 'restraint of trade', 'Section 27', 'Indian Contract Act', 'reasonableness', 'business sale'],
  },

  // ── Intellectual Property (q069–q074) ───────────────────────────────────

  {
    id: 'q069',
    query: 'Who owns the copyright in software developed by an employee in the course of employment under the Copyright Act 1957?',
    category: 'ip',
    expected_context: 'High Court and Supreme Court judgments on copyright ownership in employment under Section 17 Copyright Act 1957',
    expected_keywords: ['copyright', 'employment', 'Section 17', 'Copyright Act 1957', 'employer', 'course of employment'],
  },
  {
    id: 'q070',
    query: 'What is the test for trademark infringement and passing off under the Trade Marks Act 1999?',
    category: 'ip',
    expected_context: 'Supreme Court and Delhi High Court judgments on trademark infringement and passing off under Trade Marks Act 1999',
    expected_keywords: ['trademark infringement', 'passing off', 'Trade Marks Act 1999', 'deceptive similarity', 'goodwill', 'likelihood of confusion'],
  },
  {
    id: 'q071',
    query: 'How does Indian law protect trade secrets and confidential business information in the absence of a specific statute?',
    category: 'ip',
    expected_context: 'Supreme Court and High Court judgments on trade secret protection through equity, contract and breach of confidence',
    expected_keywords: ['trade secret', 'confidential information', 'breach of confidence', 'Indian Contract Act', 'injunction', 'employment'],
  },
  {
    id: 'q072',
    query: 'On what grounds can a court grant an interim injunction for patent infringement under the Patents Act 1970?',
    category: 'ip',
    expected_context: 'Delhi High Court and Supreme Court judgments on interim injunction in patent infringement under Patents Act 1970',
    expected_keywords: ['patent infringement', 'interim injunction', 'Patents Act 1970', 'prima facie case', 'balance of convenience', 'irreparable harm'],
  },
  {
    id: 'q073',
    query: 'What is the legal distinction between an assignment of copyright and a licence under the Copyright Act 1957?',
    category: 'ip',
    expected_context: 'High Court judgments on copyright assignment and licence under Sections 18-19 Copyright Act 1957',
    expected_keywords: ['copyright assignment', 'copyright licence', 'Section 18', 'Section 19', 'Copyright Act 1957', 'exclusive licence'],
  },
  {
    id: 'q074',
    query: 'Can moral rights in a literary or artistic work be waived by contract under the Indian Copyright Act?',
    category: 'ip',
    expected_context: 'High Court judgments on moral rights under Section 57 Copyright Act 1957 and waivability',
    expected_keywords: ['moral rights', 'Section 57', 'Copyright Act 1957', 'author', 'integrity', 'waiver'],
  },

  // ── Employment / Labour (q075–q080) ─────────────────────────────────────

  {
    id: 'q075',
    query: 'What notice period is required for termination of employment and what constitutes wrongful termination under Indian law?',
    category: 'employment',
    expected_context: 'Supreme Court and High Court judgments on notice period and wrongful termination under Industrial Disputes Act',
    expected_keywords: ['wrongful termination', 'notice period', 'Industrial Disputes Act', 'retrenchment', 'Section 25F', 'compensation'],
  },
  {
    id: 'q076',
    query: 'Are non-solicitation clauses in employment agreements enforceable after employment ends under Indian law?',
    category: 'employment',
    expected_context: 'High Court judgments on non-solicitation clause enforceability and Section 27 Indian Contract Act post-employment',
    expected_keywords: ['non-solicitation', 'post-employment', 'Section 27', 'Indian Contract Act', 'restraint of trade', 'reasonable restriction'],
  },
  {
    id: 'q077',
    query: 'What is the legal effect of a garden leave clause in an employment contract under Indian law?',
    category: 'employment',
    expected_context: 'High Court judgments on garden leave provisions and their interaction with restraint of trade under Indian law',
    expected_keywords: ['garden leave', 'employment contract', 'restraint of trade', 'Indian Contract Act', 'notice period', 'Section 27'],
  },
  {
    id: 'q078',
    query: 'What are the conditions for entitlement to gratuity under the Payment of Gratuity Act 1972 and how is it calculated?',
    category: 'employment',
    expected_context: 'Supreme Court and High Court judgments on gratuity entitlement under Payment of Gratuity Act 1972',
    expected_keywords: ['gratuity', 'Payment of Gratuity Act 1972', 'five years', 'continuous service', 'last drawn salary', 'termination'],
  },
  {
    id: 'q079',
    query: 'What are the obligations of an employer to constitute an Internal Complaints Committee under the POSH Act 2013?',
    category: 'employment',
    expected_context: 'High Court judgments on employer obligations under Sexual Harassment of Women at Workplace (POSH) Act 2013',
    expected_keywords: ['POSH Act', 'Internal Complaints Committee', 'sexual harassment', 'employer obligations', 'Section 4', 'workplace'],
  },
  {
    id: 'q080',
    query: 'What is the legal status of fixed-term employment contracts in India and can they be renewed indefinitely?',
    category: 'employment',
    expected_context: 'Supreme Court and High Court judgments on fixed-term employment and Industrial Employment Standing Orders',
    expected_keywords: ['fixed-term employment', 'Industrial Disputes Act', 'standing orders', 'regular employment', 'renewal', 'contract labour'],
  },

  // ── Arbitration / Dispute Resolution (q081–q086) ────────────────────────

  {
    id: 'q081',
    query: 'Are fraud and serious allegations arbitrable under the Arbitration and Conciliation Act 1996 in India?',
    category: 'arbitration',
    expected_context: 'Supreme Court judgments on arbitrability of fraud under Arbitration and Conciliation Act 1996',
    expected_keywords: ['arbitrability', 'fraud', 'Arbitration Act 1996', 'N. Radhakrishnan', 'Avitel Post Studioz', 'serious allegations'],
  },
  {
    id: 'q082',
    query: 'How are foreign arbitral awards enforced in India under Part II of the Arbitration and Conciliation Act 1996?',
    category: 'arbitration',
    expected_context: 'Supreme Court judgments on enforcement of foreign arbitral awards under New York Convention and Arbitration Act 1996',
    expected_keywords: ['foreign arbitral award', 'enforcement', 'New York Convention', 'Part II', 'Arbitration Act 1996', 'public policy'],
  },
  {
    id: 'q083',
    query: 'What is the procedure for appointment of an arbitrator by the Supreme Court or High Court under Section 11 of the Arbitration Act 1996?',
    category: 'arbitration',
    expected_context: 'Supreme Court judgments on Section 11 appointment of arbitrators under Arbitration and Conciliation Act 1996',
    expected_keywords: ['Section 11', 'appointment of arbitrator', 'Arbitration Act 1996', 'Supreme Court', 'High Court', 'arbitration agreement'],
  },
  {
    id: 'q084',
    query: 'What interim relief can courts grant under Section 9 of the Arbitration and Conciliation Act 1996?',
    category: 'arbitration',
    expected_context: 'Supreme Court and High Court judgments on Section 9 interim measures under Arbitration Act 1996',
    expected_keywords: ['Section 9', 'interim relief', 'Arbitration Act 1996', 'injunction', 'pre-arbitration', 'protective measures'],
  },
  {
    id: 'q085',
    query: 'On what grounds can an arbitral award be challenged under Section 34 of the Arbitration and Conciliation Act 1996?',
    category: 'arbitration',
    expected_context: 'Supreme Court judgments on scope of challenge under Section 34 Arbitration Act 1996 and patent illegality',
    expected_keywords: ['Section 34', 'Arbitration Act 1996', 'patent illegality', 'public policy', 'setting aside', 'arbitral award'],
  },
  {
    id: 'q086',
    query: 'What are the key differences between institutional arbitration and ad hoc arbitration under Indian law?',
    category: 'arbitration',
    expected_context: 'Supreme Court judgments and Law Commission reports on institutional vs ad hoc arbitration under Arbitration Act 1996',
    expected_keywords: ['institutional arbitration', 'ad hoc arbitration', 'Arbitration Act 1996', 'arbitral institution', 'rules', 'costs'],
  },

  // ── Real Estate / Property (q087–q091) ─────────────────────────────────

  {
    id: 'q087',
    query: 'What are the obligations of a real estate developer under RERA 2016 and what remedies are available to homebuyers?',
    category: 'real_estate',
    expected_context: 'Supreme Court and RERA Authority judgments on developer obligations and homebuyer remedies under RERA Act 2016',
    expected_keywords: ['RERA', 'Real Estate Act 2016', 'developer obligations', 'homebuyer', 'registration', 'possession'],
  },
  {
    id: 'q088',
    query: 'What is the legal distinction between a leave and licence agreement and a lease under Indian property law?',
    category: 'real_estate',
    expected_context: 'Supreme Court judgments distinguishing leave and licence from lease under Section 105 and 52 Transfer of Property Act',
    expected_keywords: ['leave and licence', 'lease', 'Transfer of Property Act', 'Section 105', 'Section 52', 'exclusive possession'],
  },
  {
    id: 'q089',
    query: 'What notice period is required to terminate a tenancy under state rent control laws and Transfer of Property Act?',
    category: 'real_estate',
    expected_context: 'Supreme Court and High Court judgments on tenancy termination notice under Transfer of Property Act and Rent Control Acts',
    expected_keywords: ['tenancy termination', 'notice period', 'Transfer of Property Act', 'Section 106', 'Rent Control Act', 'eviction'],
  },
  {
    id: 'q090',
    query: 'When will a court order specific performance of an agreement to sell immovable property under the Specific Relief Act 1963?',
    category: 'real_estate',
    expected_context: 'Supreme Court judgments on specific performance of sale agreements under Specific Relief Act 1963 as amended in 2018',
    expected_keywords: ['specific performance', 'agreement to sell', 'Specific Relief Act 1963', 'immovable property', 'readiness', 'willingness'],
  },
  {
    id: 'q091',
    query: 'What are the stamp duty and registration requirements for immovable property transactions in India?',
    category: 'real_estate',
    expected_context: 'Supreme Court and High Court judgments on stamp duty, Indian Stamp Act and Registration Act for property transactions',
    expected_keywords: ['stamp duty', 'registration', 'Indian Stamp Act', 'Registration Act', 'immovable property', 'Section 17'],
  },

  // ── Constitutional / Fundamental Rights — new angles (q092–q096) ────────

  {
    id: 'q092',
    query: 'What is the proportionality test applied by Indian courts when reviewing restrictions on fundamental rights?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on proportionality standard in fundamental rights review — Puttaswamy, Anuradha Bhasin',
    expected_keywords: ['proportionality', 'fundamental rights', 'legitimate aim', 'least restrictive means', 'Article 19', 'judicial review'],
  },
  {
    id: 'q093',
    query: 'How has the right to privacy recognised in Puttaswamy been applied to data protection and government surveillance in India?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments applying Puttaswamy right to privacy to Aadhaar, internet shutdown and surveillance cases',
    expected_keywords: ['right to privacy', 'Puttaswamy', 'data protection', 'Aadhaar', 'Article 21', 'surveillance'],
  },
  {
    id: 'q094',
    query: 'What procedural safeguards does Article 21 of the Constitution require before the state deprives a person of life or personal liberty?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on Article 21 procedural due process — Maneka Gandhi and subsequent cases',
    expected_keywords: ['Article 21', 'procedural due process', 'Maneka Gandhi', 'fair procedure', 'personal liberty', 'just fair reasonable'],
  },
  {
    id: 'q095',
    query: 'What are the reasonable restrictions permissible on the right to carry on any trade or business under Article 19(1)(g) of the Constitution?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments on Article 19(1)(g) right to trade and Article 19(6) reasonable restrictions',
    expected_keywords: ['Article 19(1)(g)', 'trade or business', 'Article 19(6)', 'reasonable restrictions', 'public interest', 'licensing'],
  },
  {
    id: 'q096',
    query: 'Which features of the Indian Constitution have been recognised as part of the basic structure that Parliament cannot abrogate?',
    category: 'constitutional',
    expected_context: 'Supreme Court judgments cataloguing basic structure features from Kesavananda Bharati to Minerva Mills',
    expected_keywords: ['basic structure', 'Kesavananda Bharati', 'Minerva Mills', 'judicial review', 'free elections', 'secularism'],
  },

  // ── Tax Law — new areas (q097–q100) ─────────────────────────────────────

  {
    id: 'q097',
    query: 'In what circumstances must a registered dealer reverse input tax credit under the CGST Act 2017?',
    category: 'tax',
    expected_context: 'High Court and AAR rulings on ITC reversal under Section 17 and Section 16 CGST Act 2017',
    expected_keywords: ['input tax credit reversal', 'ITC', 'Section 17', 'CGST Act', 'exempt supply', 'blocked credit'],
  },
  {
    id: 'q098',
    query: 'What is the arm\'s length standard in Indian transfer pricing law and how do authorities determine it?',
    category: 'tax',
    expected_context: 'Income Tax Appellate Tribunal and High Court judgments on transfer pricing arm\'s length standard under Section 92C Income Tax Act',
    expected_keywords: ['transfer pricing', "arm's length", 'Section 92C', 'Income Tax Act', 'comparable uncontrolled price', 'international transaction'],
  },
  {
    id: 'q099',
    query: 'Is TDS deductible on payments for software licences and cloud services to foreign companies under Section 194J and Section 195 of the Income Tax Act?',
    category: 'tax',
    expected_context: 'Supreme Court and High Court judgments on TDS on software payments — Skilsoft Ireland, Infosys judgments and CBDT circulars',
    expected_keywords: ['TDS', 'Section 195', 'Section 194J', 'software licence', 'royalty', 'Income Tax Act'],
  },
  {
    id: 'q100',
    query: 'What is an Advance Pricing Agreement under the Income Tax Act and how does it provide certainty on transfer pricing?',
    category: 'tax',
    expected_context: 'CBDT guidelines and Income Tax Act provisions on APA programme under Sections 92CC and 92CD',
    expected_keywords: ['advance pricing agreement', 'APA', 'Section 92CC', 'transfer pricing', 'Income Tax Act', 'certainty'],
  },
];

const _queryCountCheck: 100 = TEST_QUERIES.length as 100;
