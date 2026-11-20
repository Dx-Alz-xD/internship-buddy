import "server-only";

/**
 * Public career-page APIs of companies that hire in India. Each was checked on 2026-11-20
 * to return postings with India locations. No keys needed; responses are cached for 12 hours.
 */
export type Board = { ats: "greenhouse" | "lever" | "ashby" | "smartrecruiters"; slug: string; name: string };

export const BOARDS: Board[] = [
  // Lever
  { ats: "lever", slug: "paytm", name: "Paytm" },
  { ats: "lever", slug: "meesho", name: "Meesho" },
  { ats: "lever", slug: "hevodata", name: "Hevo Data" },
  { ats: "lever", slug: "zeta", name: "Zeta" },
  { ats: "lever", slug: "mindtickle", name: "Mindtickle" },
  { ats: "lever", slug: "fampay", name: "FamPay" },
  { ats: "lever", slug: "cred", name: "CRED" },
  { ats: "lever", slug: "pocketfm", name: "Pocket FM" },
  // SmartRecruiters
  { ats: "smartrecruiters", slug: "Swiggy", name: "Swiggy" },
  { ats: "smartrecruiters", slug: "PHONEPELIMITED", name: "PhonePe" },
  { ats: "smartrecruiters", slug: "Freshworks", name: "Freshworks" },
  { ats: "smartrecruiters", slug: "ixigo", name: "ixigo" },
  { ats: "smartrecruiters", slug: "Nagarro1", name: "Nagarro" },
  // Greenhouse
  { ats: "greenhouse", slug: "stripe", name: "Stripe" },
  { ats: "greenhouse", slug: "rubrik", name: "Rubrik" },
  { ats: "greenhouse", slug: "sigmoid", name: "Sigmoid" },
  { ats: "greenhouse", slug: "hackerrank", name: "HackerRank" },
  { ats: "greenhouse", slug: "agoda", name: "Agoda" },
  { ats: "greenhouse", slug: "towerresearchcapital", name: "Tower Research Capital" },
  { ats: "greenhouse", slug: "razorpaysoftwareprivatelimited", name: "Razorpay" },
  { ats: "greenhouse", slug: "groww", name: "Groww" },
  { ats: "greenhouse", slug: "inmobi", name: "InMobi" },
  { ats: "greenhouse", slug: "highradius", name: "HighRadius" },
  { ats: "greenhouse", slug: "zenoti", name: "Zenoti" },
  { ats: "greenhouse", slug: "pubmatic", name: "PubMatic" },
  { ats: "greenhouse", slug: "truecaller", name: "Truecaller" },
  { ats: "greenhouse", slug: "glance", name: "Glance" },
  { ats: "greenhouse", slug: "druva", name: "Druva" },
  { ats: "greenhouse", slug: "harnessinc", name: "Harness" },
  { ats: "greenhouse", slug: "sumologic", name: "Sumo Logic" },
  { ats: "greenhouse", slug: "gitlab", name: "GitLab" },
  { ats: "greenhouse", slug: "twilio", name: "Twilio" },
  { ats: "greenhouse", slug: "arcesiumllc", name: "Arcesium" },
  { ats: "greenhouse", slug: "gravitonresearchcapital", name: "Graviton Research Capital" },
  { ats: "greenhouse", slug: "nksecuritiesresearch", name: "NK Securities Research" },
  { ats: "greenhouse", slug: "squarepointcapital", name: "Squarepoint Capital" },
  { ats: "greenhouse", slug: "gleanwork", name: "Glean" },
  { ats: "greenhouse", slug: "zetaglobal", name: "Zeta Global" },
  // Ashby
  { ats: "ashby", slug: "sarvam", name: "Sarvam AI" },
  { ats: "ashby", slug: "composio", name: "Composio" },
  { ats: "ashby", slug: "tekion", name: "Tekion" },
  { ats: "ashby", slug: "bureau", name: "Bureau" },
  { ats: "ashby", slug: "signoz", name: "SigNoz" },
  { ats: "ashby", slug: "plane", name: "Plane" },
  { ats: "ashby", slug: "spotdraft", name: "SpotDraft" },
  { ats: "ashby", slug: "atlan", name: "Atlan" },
];
