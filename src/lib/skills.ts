/**
 * Skill dictionary used for three things:
 *  - reading skills out of an uploaded CV
 *  - tagging listings that do not come with a skills list (LinkedIn, Google Jobs, Unstop)
 *  - normalising user-typed skills so "reactjs" and "React" count as the same thing
 *
 * Each entry is the display name followed by lowercase aliases. Aliases are matched as whole words.
 */
const SKILL_TABLE: [string, ...string[]][] = [
  // Languages
  ["JavaScript", "javascript", "js", "es6", "ecmascript"],
  ["TypeScript", "typescript", "ts"],
  ["Python", "python", "python3"],
  ["Java", "java", "core java", "java 8", "j2ee"],
  ["C++", "c++", "cpp", "c/c++"],
  ["C", "c programming", "c language", "c/c++", "embedded c"],
  ["C#", "c#", "csharp", "c sharp"],
  ["Go", "golang", "go lang"],
  ["Rust", "rust"],
  ["Kotlin", "kotlin"],
  ["Swift", "swift"],
  ["Dart", "dart"],
  ["PHP", "php"],
  ["Ruby", "ruby", "ruby on rails", "rails"],
  ["R", "r programming", "r language", "rstudio"],
  ["MATLAB", "matlab", "simulink"],
  ["Scala", "scala"],
  ["Solidity", "solidity"],
  ["Bash", "bash", "shell scripting", "shell script"],
  ["SQL", "sql", "mysql", "postgresql", "postgres", "sqlite", "pl/sql", "t-sql", "sql server"],
  // Web
  ["HTML", "html", "html5", "html 5"],
  ["CSS", "css", "css3", "scss", "sass"],
  ["React", "react", "react.js", "reactjs", "react js"],
  ["Next.js", "next.js", "nextjs", "next js"],
  ["Angular", "angular", "angularjs", "angular.js"],
  ["Vue", "vue", "vue.js", "vuejs", "nuxt"],
  ["Svelte", "svelte", "sveltekit"],
  ["Redux", "redux", "redux toolkit"],
  ["Tailwind CSS", "tailwind", "tailwindcss", "tailwind css"],
  ["Bootstrap", "bootstrap"],
  ["jQuery", "jquery"],
  ["Node.js", "node.js", "nodejs", "node js", "node"],
  ["Express", "express.js", "expressjs", "express js"],
  ["NestJS", "nestjs", "nest.js"],
  ["Django", "django"],
  ["Flask", "flask"],
  ["FastAPI", "fastapi"],
  ["Spring Boot", "spring boot", "springboot", "spring framework", "spring mvc"],
  [".NET", ".net", "asp.net", "dotnet", ".net core"],
  ["Laravel", "laravel"],
  ["GraphQL", "graphql"],
  ["REST APIs", "rest api", "rest apis", "restful", "api development", "web services"],
  ["WordPress", "wordpress"],
  ["Shopify", "shopify"],
  // Mobile
  ["Android", "android", "android studio", "android development"],
  ["iOS", "ios", "ios development"],
  ["SwiftUI", "swiftui"],
  ["Xcode", "xcode"],
  ["Jetpack Compose", "jetpack compose"],
  ["Flutter", "flutter"],
  ["React Native", "react native", "react-native"],
  ["Firebase", "firebase", "firestore"],
  // Data / DB
  ["MongoDB", "mongodb", "mongo", "mongoose"],
  ["Redis", "redis"],
  ["PostgreSQL", "postgresql", "postgres"],
  ["Elasticsearch", "elasticsearch", "elastic search"],
  ["Kafka", "kafka"],
  ["Spark", "spark", "pyspark", "apache spark"],
  ["Hadoop", "hadoop"],
  ["Snowflake", "snowflake"],
  ["Airflow", "airflow"],
  ["ETL", "etl", "data pipeline", "data pipelines"],
  // Data science / AI
  ["Pandas", "pandas"],
  ["NumPy", "numpy"],
  ["Matplotlib", "matplotlib", "seaborn"],
  ["Scikit-learn", "scikit-learn", "sklearn", "scikit learn"],
  ["Machine Learning", "machine learning", "ml"],
  ["Deep Learning", "deep learning", "neural networks", "neural network", "cnn", "rnn"],
  ["NLP", "nlp", "natural language processing"],
  ["Computer Vision", "computer vision", "opencv", "image processing"],
  ["TensorFlow", "tensorflow", "keras"],
  ["PyTorch", "pytorch"],
  ["Generative AI", "generative ai", "genai", "gen ai", "llm", "llms", "large language models", "prompt engineering", "langchain", "rag"],
  ["Statistics", "statistics", "statistical analysis", "probability"],
  ["Data Analysis", "data analysis", "data analytics", "data visualization", "data visualisation"],
  ["Power BI", "power bi", "powerbi"],
  ["Tableau", "tableau"],
  ["Excel", "excel", "ms excel", "ms-excel", "microsoft excel", "advanced excel", "spreadsheets", "google sheets"],
  // Cloud / DevOps
  ["AWS", "aws", "amazon web services", "ec2", "s3", "lambda"],
  ["Azure", "azure", "microsoft azure"],
  ["Google Cloud", "gcp", "google cloud", "google cloud platform"],
  ["Docker", "docker", "containerization"],
  ["Kubernetes", "kubernetes", "k8s", "eks", "gke"],
  ["CI/CD", "ci/cd", "cicd", "jenkins", "github actions", "gitlab ci"],
  ["Terraform", "terraform"],
  ["Linux", "linux", "unix", "ubuntu"],
  ["Git", "git", "github", "gitlab", "version control"],
  ["Networking", "networking", "computer networks", "tcp/ip", "ccna"],
  // Security
  ["Penetration Testing", "penetration testing", "pentesting", "vapt", "ethical hacking", "burp suite"],
  ["Wireshark", "wireshark"],
  ["Cryptography", "cryptography"],
  // CS fundamentals
  ["Data Structures", "data structures", "dsa", "data structures and algorithms"],
  ["Algorithms", "algorithms", "dsa", "competitive programming"],
  ["OOP", "oop", "oops", "object oriented programming", "object-oriented"],
  ["DBMS", "dbms", "database management"],
  ["Operating Systems", "operating systems", "operating system"],
  ["System Design", "system design", "distributed systems", "microservices"],
  // Testing
  ["Manual Testing", "manual testing", "test cases"],
  ["Selenium", "selenium"],
  ["Jest", "jest"],
  ["Cypress", "cypress", "playwright"],
  // Hardware / core
  ["Embedded C", "embedded c", "embedded systems"],
  ["Arduino", "arduino"],
  ["Raspberry Pi", "raspberry pi"],
  ["IoT", "iot", "internet of things"],
  ["VLSI", "vlsi", "verilog", "vhdl", "fpga"],
  ["PCB Design", "pcb", "pcb design"],
  ["AutoCAD", "autocad", "auto cad"],
  ["SolidWorks", "solidworks", "solid works"],
  ["CATIA", "catia"],
  ["ANSYS", "ansys"],
  ["Fusion 360", "fusion 360"],
  // Design
  ["Figma", "figma"],
  ["Adobe XD", "adobe xd"],
  ["UI Design", "ui design", "user interface design", "ui"],
  ["UX Research", "ux research", "user research", "usability testing", "ux"],
  ["Wireframing", "wireframing", "wireframes"],
  ["Prototyping", "prototyping", "prototypes"],
  ["Adobe Photoshop", "photoshop", "adobe photoshop"],
  ["Adobe Illustrator", "illustrator", "adobe illustrator"],
  ["Canva", "canva"],
  ["Adobe Premiere Pro", "premiere pro", "adobe premiere", "premiere"],
  ["After Effects", "after effects", "adobe after effects"],
  ["DaVinci Resolve", "davinci resolve", "davinci"],
  ["Video Editing", "video editing", "video editor"],
  ["Blender", "blender", "3d modeling"],
  // Business
  ["Digital Marketing", "digital marketing", "online marketing", "performance marketing"],
  ["SEO", "seo", "search engine optimization"],
  ["Social Media Marketing", "social media marketing", "social media", "instagram marketing", "smm"],
  ["Google Analytics", "google analytics", "ga4"],
  ["Google Ads", "google ads", "adwords", "sem"],
  ["Email Marketing", "email marketing", "mailchimp"],
  ["Content Writing", "content writing", "content writer", "blog writing", "article writing"],
  ["Copywriting", "copywriting", "copy writing", "copywriter"],
  ["English Proficiency", "english proficiency", "english (proficiency)", "written english", "spoken english"],
  ["Communication", "communication", "communication skills", "interpersonal skills"],
  ["Sales", "sales", "inside sales", "b2b sales", "lead generation"],
  ["Negotiation", "negotiation"],
  ["CRM", "crm", "salesforce", "hubspot", "zoho crm"],
  ["Market Research", "market research", "competitor analysis"],
  ["Product Management", "product management", "product roadmap", "prd"],
  ["Project Management", "project management", "jira", "agile", "scrum"],
  ["Supply Chain", "supply chain", "logistics", "inventory management"],
  ["Recruitment", "recruitment", "recruiting", "talent acquisition"],
  ["Accounting", "accounting", "bookkeeping", "gst"],
  ["Tally", "tally", "tally erp", "tally prime"],
  ["Financial Modeling", "financial modeling", "financial modelling", "valuation", "dcf"],
  ["Financial Analysis", "financial analysis", "equity research", "investment research"],
  ["MS Office", "ms office", "microsoft office", "ms word"],
  ["PowerPoint", "powerpoint", "ms powerpoint"],
  ["Problem Solving", "problem solving", "problem-solving", "analytical skills"],
];

export type SkillEntry = { name: string; aliases: string[] };

export const SKILLS: SkillEntry[] = SKILL_TABLE.map(([name, ...aliases]) => ({ name, aliases }));
export const SKILL_NAMES = SKILLS.map((s) => s.name);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const MATCHERS = SKILLS.map((s) => ({
  name: s.name,
  re: new RegExp(`(?<![a-z0-9+#])(?:${s.aliases.map(escape).join("|")})(?![a-z0-9+#])`, "i"),
}));

/** Skills that look like normal English words; only trusted when found in a short, list-like context. */
const NOISY = new Set(["Swift", "Spark", "Sales", "Communication", "Problem Solving", "Rust"]);

export function extractSkills(text: string, opts: { strict?: boolean } = {}): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const m of MATCHERS) {
    if (opts.strict && NOISY.has(m.name)) continue;
    if (m.re.test(text)) found.push(m.name);
  }
  // "MS Excel" and "Excel" are the same thing for matching purposes.
  return dedupeSkills(found);
}

const CANON: Record<string, string> = {};
for (const s of SKILLS) {
  CANON[s.name.toLowerCase()] = s.name;
  for (const a of s.aliases) if (!CANON[a]) CANON[a] = s.name;
}

/** Map any typed skill onto its canonical name; unknown skills are kept as typed. */
export function canonicalSkill(skill: string): string {
  const key = skill.trim().toLowerCase();
  return CANON[key] ?? skill.trim();
}

export function dedupeSkills(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const c = canonicalSkill(raw);
    const k = c.toLowerCase();
    if (!c || seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
