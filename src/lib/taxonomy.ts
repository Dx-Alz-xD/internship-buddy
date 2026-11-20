export type Role = {
  id: string;
  label: string;
  domain: string;
  /** What gets typed into each job board's search box. */
  query: string;
  /** Internshala's own category name; its free-text search misses a lot, its categories do not. */
  internshala?: string;
  /** Words that mean a listing title is about this role. */
  keywords: string[];
  skills: string[];
};

export const ROLES: Role[] = [
  // Engineering
  { id: "swe", internshala: "Software Development", label: "Software Engineering", domain: "Engineering", query: "software development", keywords: ["software", "sde", "developer", "programmer", "engineer"], skills: ["Data Structures", "Algorithms", "Java", "Python", "C++", "Git", "SQL"] },
  { id: "frontend", internshala: "Front End Development", label: "Frontend Development", domain: "Engineering", query: "frontend development", keywords: ["frontend", "front end", "front-end", "react", "ui developer", "web developer", "angular", "vue"], skills: ["JavaScript", "TypeScript", "React", "HTML", "CSS", "Tailwind CSS", "Next.js"] },
  { id: "backend", internshala: "Backend Development", label: "Backend Development", domain: "Engineering", query: "backend development", keywords: ["backend", "back end", "back-end", "api", "node", "django", "spring", "server"], skills: ["Node.js", "Python", "Java", "SQL", "REST APIs", "MongoDB", "Docker"] },
  { id: "fullstack", internshala: "Full Stack Development", label: "Full Stack Development", domain: "Engineering", query: "full stack development", keywords: ["full stack", "fullstack", "full-stack", "mern", "web developer", "web development"], skills: ["JavaScript", "React", "Node.js", "Express", "MongoDB", "SQL", "Git"] },
  { id: "android", internshala: "Android App Development", label: "Android Development", domain: "Engineering", query: "android app development", keywords: ["android", "kotlin", "mobile app", "app developer"], skills: ["Kotlin", "Java", "Android", "Jetpack Compose", "Firebase"] },
  { id: "ios", internshala: "iOS App Development", label: "iOS Development", domain: "Engineering", query: "ios app development", keywords: ["ios", "swift", "iphone", "mobile app"], skills: ["Swift", "SwiftUI", "iOS", "Xcode"] },
  { id: "flutter", internshala: "Flutter Development", label: "Flutter / React Native", domain: "Engineering", query: "flutter development", keywords: ["flutter", "react native", "cross platform", "mobile app", "app developer"], skills: ["Flutter", "Dart", "React Native", "Firebase"] },
  { id: "devops", internshala: "Cloud Computing", label: "DevOps & Cloud", domain: "Engineering", query: "devops cloud", keywords: ["devops", "cloud", "aws", "azure", "sre", "site reliability", "infrastructure", "kubernetes"], skills: ["Linux", "Docker", "Kubernetes", "AWS", "CI/CD", "Terraform"] },
  { id: "cyber", internshala: "Cyber Security", label: "Cybersecurity", domain: "Engineering", query: "cyber security", keywords: ["cyber", "security", "soc", "penetration", "vapt", "infosec", "ethical hacking"], skills: ["Networking", "Linux", "Python", "Penetration Testing", "Wireshark"] },
  { id: "qa", internshala: "Software Testing", label: "QA & Testing", domain: "Engineering", query: "software testing", keywords: ["qa", "testing", "tester", "test automation", "quality assurance", "sdet"], skills: ["Manual Testing", "Selenium", "Java", "Python", "SQL"] },
  { id: "embedded", internshala: "Embedded Systems", label: "Embedded & Electronics", domain: "Engineering", query: "embedded systems", keywords: ["embedded", "electronics", "iot", "vlsi", "firmware", "pcb", "hardware"], skills: ["C", "Embedded C", "Arduino", "Raspberry Pi", "IoT", "MATLAB"] },
  { id: "core", internshala: "Mechanical Engineering", label: "Mechanical / Civil / Core", domain: "Engineering", query: "mechanical engineering", keywords: ["mechanical", "civil", "design engineer", "autocad", "solidworks", "production", "manufacturing"], skills: ["AutoCAD", "SolidWorks", "CATIA", "MATLAB", "ANSYS"] },
  // Data & AI
  { id: "data-science", internshala: "Data Science", label: "Data Science", domain: "Data & AI", query: "data science", keywords: ["data science", "data scientist", "machine learning", "analytics", "ml"], skills: ["Python", "Pandas", "NumPy", "Machine Learning", "SQL", "Statistics"] },
  { id: "ml", internshala: "Machine Learning", label: "Machine Learning / AI", domain: "Data & AI", query: "machine learning", keywords: ["machine learning", "ml", "ai", "artificial intelligence", "deep learning", "nlp", "computer vision", "genai", "llm"], skills: ["Python", "PyTorch", "TensorFlow", "Machine Learning", "Deep Learning", "NLP"] },
  { id: "data-analytics", internshala: "Analytics", label: "Data Analytics", domain: "Data & AI", query: "data analytics", keywords: ["data analyst", "analytics", "business analyst", "power bi", "tableau", "mis", "excel"], skills: ["Excel", "SQL", "Power BI", "Tableau", "Python", "Statistics"] },
  // Design & product
  { id: "uiux", internshala: "UI/UX Design", label: "UI/UX Design", domain: "Design & Product", query: "ui ux design", keywords: ["ui", "ux", "product design", "user experience", "user interface", "figma"], skills: ["Figma", "UI Design", "UX Research", "Wireframing", "Prototyping"] },
  { id: "graphic", internshala: "Graphic Design", label: "Graphic Design", domain: "Design & Product", query: "graphic design", keywords: ["graphic", "designer", "canva", "visual", "illustrat", "photoshop"], skills: ["Adobe Photoshop", "Adobe Illustrator", "Canva", "Figma"] },
  { id: "video", internshala: "Video Making/Editing", label: "Video Editing & Animation", domain: "Design & Product", query: "video editing", keywords: ["video", "editor", "motion", "animation", "premiere", "after effects"], skills: ["Adobe Premiere Pro", "After Effects", "Video Editing", "DaVinci Resolve"] },
  { id: "product", internshala: "Product Management", label: "Product Management", domain: "Design & Product", query: "product management", keywords: ["product manager", "product management", "product analyst", "apm", "product intern"], skills: ["Product Management", "Market Research", "SQL", "Figma", "Excel"] },
  // Business
  { id: "marketing", internshala: "Digital Marketing", label: "Digital Marketing", domain: "Business", query: "digital marketing", keywords: ["marketing", "seo", "social media", "growth", "campaign", "performance marketing"], skills: ["Digital Marketing", "SEO", "Social Media Marketing", "Google Analytics", "Canva"] },
  { id: "content", internshala: "Content Writing", label: "Content Writing", domain: "Business", query: "content writing", keywords: ["content", "writer", "writing", "copywriter", "copywriting", "blog", "editor"], skills: ["Content Writing", "Copywriting", "SEO", "English Proficiency"] },
  { id: "bizdev", internshala: "Business Development", label: "Business Development & Sales", domain: "Business", query: "business development", keywords: ["business development", "bde", "sales", "inside sales", "partnership", "client"], skills: ["Communication", "Negotiation", "Sales", "Excel", "CRM"] },
  { id: "finance", internshala: "Finance", label: "Finance & Accounting", domain: "Business", query: "finance", keywords: ["finance", "accounting", "accounts", "investment", "equity research", "audit", "tax", "ca"], skills: ["Excel", "Accounting", "Financial Modeling", "Tally", "Financial Analysis"] },
  { id: "hr", internshala: "Human Resources (HR)", label: "Human Resources", domain: "Business", query: "human resources", keywords: ["hr", "human resource", "talent acquisition", "recruit", "people"], skills: ["Recruitment", "Communication", "Excel", "MS Office"] },
  { id: "operations", internshala: "Operations", label: "Operations", domain: "Business", query: "operations", keywords: ["operations", "supply chain", "logistics", "project coordinator", "coordinator"], skills: ["Excel", "Communication", "Project Management", "Supply Chain"] },
  { id: "consulting", internshala: "Strategy", label: "Consulting & Strategy", domain: "Business", query: "consulting", keywords: ["consult", "strategy", "research analyst", "management trainee"], skills: ["Market Research", "Excel", "PowerPoint", "Problem Solving"] },
];

export const ROLE_DOMAINS = Array.from(new Set(ROLES.map((r) => r.domain)));

export function getRole(id: string): Role {
  const found = ROLES.find((r) => r.id === id);
  if (found) return found;
  // Custom roles are stored as "custom:<label>"
  const label = id.startsWith("custom:") ? id.slice(7) : id;
  const words = label.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return { id, label, domain: "Custom", query: label.toLowerCase(), keywords: [label.toLowerCase(), ...words], skills: [] };
}

export const DEGREES = [
  "B.Tech / B.E.",
  "BCA",
  "B.Sc",
  "B.Com",
  "BBA / BMS",
  "B.A.",
  "B.Des",
  "Integrated M.Tech / Dual degree",
  "M.Tech / M.E.",
  "MCA",
  "M.Sc",
  "MBA / PGDM",
  "M.A. / M.Com",
  "Diploma",
  "Other",
];

export const BRANCHES = [
  "Computer Science",
  "Information Technology",
  "Electronics & Communication",
  "Electrical",
  "Mechanical",
  "Civil",
  "Chemical",
  "AI & Data Science",
  "Mathematics",
  "Physics",
  "Statistics",
  "Economics",
  "Commerce",
  "Finance",
  "Marketing",
  "Design",
  "English",
  "Psychology",
];

export const YEARS: { value: "1" | "2" | "3" | "4" | "5" | "grad"; label: string; hint: string }[] = [
  { value: "1", label: "1st year", hint: "Short, part-time and remote internships" },
  { value: "2", label: "2nd year", hint: "First proper internship" },
  { value: "3", label: "3rd year", hint: "Summer internships, PPO chances" },
  { value: "4", label: "4th / final year", hint: "Internships with job offers, full-time roles" },
  { value: "5", label: "5th year", hint: "Dual degree final year" },
  { value: "grad", label: "Graduated", hint: "Entry-level jobs and internships" },
];

export const COLLEGES = [
  "IIT Bombay", "IIT Delhi", "IIT Madras", "IIT Kanpur", "IIT Kharagpur", "IIT Roorkee", "IIT Guwahati", "IIT Hyderabad", "IIT (BHU) Varanasi", "IIT Indore", "IIT Dhanbad (ISM)",
  "NIT Trichy", "NIT Surathkal", "NIT Warangal", "NIT Calicut", "NIT Rourkela", "MNIT Jaipur", "MNNIT Allahabad", "VNIT Nagpur", "NIT Kurukshetra",
  "IIIT Hyderabad", "IIIT Delhi", "IIIT Bangalore", "IIIT Allahabad",
  "BITS Pilani", "BITS Goa", "BITS Hyderabad",
  "Delhi Technological University (DTU)", "Netaji Subhas University of Technology (NSUT)", "IGDTUW", "Jamia Millia Islamia", "Delhi University", "Jadavpur University", "Anna University",
  "VIT Vellore", "Manipal Institute of Technology", "SRM Institute of Science and Technology", "Amity University", "Thapar Institute", "PES University", "RV College of Engineering", "BMS College of Engineering",
  "COEP Technological University", "VJTI Mumbai", "PICT Pune", "Chandigarh University", "Lovely Professional University", "KIIT Bhubaneswar", "Shiv Nadar University", "Ashoka University",
  "SRCC", "St. Stephen's College", "Christ University", "NMIMS", "Symbiosis International University", "IIM Ahmedabad", "IIM Bangalore", "IIM Calcutta",
];

export const CITIES = [
  "Bangalore", "Delhi", "Gurgaon", "Noida", "Mumbai", "Pune", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad",
  "Jaipur", "Chandigarh", "Indore", "Kochi", "Coimbatore", "Lucknow", "Bhubaneswar", "Nagpur", "Thiruvananthapuram", "Mohali",
];

export const COUNTRIES: { code: string; label: string }[] = [
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "ca", label: "Canada" },
  { code: "de", label: "Germany" },
  { code: "sg", label: "Singapore" },
  { code: "ae", label: "UAE" },
  { code: "au", label: "Australia" },
  { code: "nl", label: "Netherlands" },
];

export const STATUS_META: Record<
  "saved" | "applied" | "assessment" | "interview" | "offer" | "rejected",
  { label: string; stamp: string; color: string; description: string }
> = {
  saved: { label: "Saved", stamp: "Saved", color: "var(--muted-foreground)", description: "Want to apply" },
  applied: { label: "Applied", stamp: "Applied", color: "var(--stamp)", description: "Application sent" },
  assessment: { label: "Test / Assignment", stamp: "Test", color: "#3b6fd1", description: "Online test or take-home task" },
  interview: { label: "Interview", stamp: "Interview", color: "var(--marigold)", description: "Interview scheduled or done" },
  offer: { label: "Offer", stamp: "Offer", color: "var(--offer)", description: "You got it" },
  rejected: { label: "Not selected", stamp: "Closed", color: "var(--reject)", description: "Rejected or withdrawn" },
};
