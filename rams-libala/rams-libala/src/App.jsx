import React, { useState, useEffect, useMemo } from "react";
import { Heart, Lock, User, Users, Sparkles, Check, X, MapPin, Calendar, Briefcase, ChevronRight, Eye, EyeOff, Plus, ArrowLeft } from "lucide-react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";

// ---------- Design tokens ----------
const COLORS = {
  bordeaux: "#5C1A2B",
  bordeauxDark: "#3D0F1C",
  cream: "#FAF6F0",
  creamDark: "#F0E9DD",
  gold: "#C9A86A",
  goldLight: "#E8D5A8",
  ink: "#2A2422",
  inkSoft: "#6B5F58",
};

const INTERESTS = [
  "Voyage", "Lecture", "Cuisine", "Sport", "Musique", "Art", "Nature",
  "Cinéma", "Danse", "Spiritualité", "Famille", "Entrepreneuriat", "Mode", "Bénévolat"
];

const RELIGIONS = ["Christianisme", "Islam", "Judaïsme", "Hindouisme", "Bouddhisme", "Autre", "Sans religion", "Peu importe"];
const SITUATIONS = ["Célibataire", "Divorcé(e)", "Veuf/Veuve"];
const ZONES = ["France", "Europe", "Afrique", "Amerique", "Peu importe"];

const TOUS_LES_PAYS = [
  "Allemagne", "Autriche", "Belgique", "Bulgarie", "Chypre", "Croatie", "Danemark",
  "Espagne", "Estonie", "Finlande", "France", "Grece", "Hongrie", "Irlande", "Italie",
  "Lettonie", "Lituanie", "Luxembourg", "Malte", "Pays-Bas", "Pologne", "Portugal",
  "Republique tcheque", "Roumanie", "Slovaquie", "Slovenie", "Suede",
  "Suisse", "Royaume-Uni", "Norvege", "Serbie", "Ukraine",
  "Algerie", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroun",
  "Cap-Vert", "Centrafrique", "Comores", "Congo Brazzaville", "Congo RDC", "Cote d Ivoire",
  "Djibouti", "Egypte", "Erythree", "Ethiopie", "Gabon", "Gambie", "Ghana", "Guinee",
  "Guinee-Bissau", "Guinee equatoriale", "Kenya", "Lesotho", "Liberia", "Libye",
  "Madagascar", "Malawi", "Mali", "Maroc", "Maurice", "Mauritanie", "Mozambique",
  "Namibie", "Niger", "Nigeria", "Ouganda", "Rwanda", "Sao Tome-et-Principe",
  "Senegal", "Sierra Leone", "Somalie", "Soudan", "Soudan du Sud", "Swaziland",
  "Tanzanie", "Tchad", "Togo", "Tunisie", "Zambie", "Zimbabwe",
  "Canada", "Etats-Unis", "Mexique", "Guatemala", "Cuba", "Haiti", "Jamaique",
  "Republique dominicaine", "Trinidad-et-Tobago", "Colombie", "Venezuela", "Guyana",
  "Suriname", "Bresil", "Perou", "Bolivie", "Equateur", "Chili", "Argentine",
  "Uruguay", "Paraguay", "Martinique", "Guadeloupe", "Guyane francaise",
  "Chine", "Japon", "Coree du Sud", "Inde", "Pakistan", "Bangladesh", "Vietnam",
  "Thailande", "Philippines", "Indonesie", "Malaisie", "Singapour", "Turquie",
  "Liban", "Syrie", "Jordanie", "Arabie Saoudite", "Emirats Arabes Unis", "Israel",
  "Australie", "Nouvelle-Zelande",
  "Autre"
];

const AGENCY_NAME = "RAM'S Libala";
const FREE_ACCESS_CODES = ["RAMSLIBALA-OFFERT", "BIENVENUE2026"];

const SUBSCRIPTION_PLANS = [
  { id: "decouverte-3", months: 3, price: 49, label: "Découverte", profiles: "2 à 3 profils proposés", stripeLink: "https://buy.stripe.com/aFacN794cb2idTI34w1ZS02" },
  { id: "standard-6", months: 6, price: 99, label: "Standard", profiles: "5 à 6 profils proposés", stripeLink: "https://buy.stripe.com/fZu4gBgwEeeu6rg20s1ZS03" },
  { id: "standard-12", months: 12, price: 160, label: "Premium", profiles: "9 à 11 profils proposés", stripeLink: "https://buy.stripe.com/7sY6oJ3JSc6m4j8dJa1ZS05" },
  {
    id: "vip-3", months: 3, price: 250, vip: true, label: "VIP",
    profiles: "2 à 4 mises en relation",
    stripeLink: "https://buy.stripe.com/9B67sNfsA9Ye16W6gI1ZS06",
    description: "Entretien personnalisé en présentiel avec l'agence (France uniquement) + organisation logistique des 2 premiers rendez-vous de mise en relation (l'agence choisit le lieu et l'horaire ; les deux personnes se rencontrent seules)",
  },
];

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

function isSubscriptionActive(profile) {
  if (!profile.subscriptionExpiresAt) return false;
  return Date.now() <= profile.subscriptionExpiresAt;
}

function daysRemaining(profile) {
  if (!profile.subscriptionExpiresAt) return 0;
  return Math.max(0, Math.ceil((profile.subscriptionExpiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---------- Matching engine ----------
function computeScore(a, b) {
  if (a.id === b.id) return 0;
  if (!isSubscriptionActive(a) || !isSubscriptionActive(b)) return 0;
  if (a.lookingForGender && b.gender && a.lookingForGender !== "Peu importe" && a.lookingForGender !== b.gender) return 0;
  if (b.lookingForGender && a.gender && b.lookingForGender !== "Peu importe" && b.lookingForGender !== a.gender) return 0;

  if (a.adminAcceptIrregular === "Non" && b.adminSituation === "Irreguliere") return 0;
  if (b.adminAcceptIrregular === "Non" && a.adminSituation === "Irreguliere") return 0;

  let score = 0;
  let max = 0;

  max += 18;
  const aAge = Number(a.age), bAge = Number(b.age);
  const aWantsMin = Number(a.ageMin) || 0, aWantsMax = Number(a.ageMax) || 200;
  const bWantsMin = Number(b.ageMin) || 0, bWantsMax = Number(b.ageMax) || 200;
  const aFits = bAge >= aWantsMin && bAge <= aWantsMax;
  const bFits = aAge >= bWantsMin && aAge <= bWantsMax;
  if (aFits && bFits) score += 18;
  else if (aFits || bFits) score += 7;

  max += 10;
  if (a.city && b.city && a.city.trim().toLowerCase() === b.city.trim().toLowerCase()) score += 10;

  max += 17;
  if (a.wantsChildren && b.wantsChildren) {
    if (a.wantsChildren === b.wantsChildren) score += 17;
    else if (a.wantsChildren === "Peu importe" || b.wantsChildren === "Peu importe") score += 10;
  }

  max += 13;
  if (a.religion && b.religion) {
    if (a.religion === b.religion) score += 13;
    else if (a.religion === "Peu importe" || b.religion === "Peu importe") score += 7;
  }

  max += 12;
  const bHeight = Number(b.height), aHeight = Number(a.height);
  const aHMin = Number(a.lookingForHeightMin) || 0, aHMax = Number(a.lookingForHeightMax) || 999;
  const bHMin = Number(b.lookingForHeightMin) || 0, bHMax = Number(b.lookingForHeightMax) || 999;
  const aHeightFits = !bHeight || (bHeight >= aHMin && bHeight <= aHMax);
  const bHeightFits = !aHeight || (aHeight >= bHMin && aHeight <= bHMax);
  if (aHeightFits && bHeightFits) score += 12;
  else if (aHeightFits || bHeightFits) score += 5;

  max += 10;
  const aZones = new Set(a.acceptedZones || []);
  const bZones = new Set(b.acceptedZones || []);
  const zonesOverlap = aZones.size === 0 || bZones.size === 0
    || aZones.has("Peu importe") || bZones.has("Peu importe")
    || [...aZones].some(z => bZones.has(z));
  if (zonesOverlap) score += 10;

  max += 20;
  const aInt = new Set(a.interests || []);
  const bInt = new Set(b.interests || []);
  const shared = [...aInt].filter(x => bInt.has(x)).length;
  const denom = Math.max(aInt.size, bInt.size, 1);
  score += Math.round((shared / denom) * 20);

  max += 15;
  const aNats = new Set(a.nationalities || []);
  const bNats = new Set(b.nationalities || []);
  const aLooking = a.lookingForNationalities || [];
  const bLooking = b.lookingForNationalities || [];
  const aWantsMatch = aLooking.length === 0 || [...aNats].some(n => aLooking.includes(n)) || bLooking.length === 0;
  const bWantsMatch = bLooking.length === 0 || [...bNats].some(n => bLooking.includes(n)) || aLooking.length === 0;
  if (aWantsMatch && bWantsMatch) score += 15;
  else if (aWantsMatch || bWantsMatch) score += 5;

  return Math.round((score / max) * 100);
}

// ---------- Firebase Configuration ----------
const firebaseConfig = {
  apiKey: "AIzaSyAz1kvmRcWbMYettLu9ZHsfOL2vjBDM2us",
  authDomain: "agence-matrimoniale-c513f.firebaseapp.com",
  projectId: "agence-matrimoniale-c513f",
  storageBucket: "agence-matrimoniale-c513f.firebasestorage.app",
  messagingSenderId: "39914907073",
  appId: "1:39914907073:web:adf478b57d39d3ddb33b40"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- Firestore helpers (un document par profil / par match) ----------
async function loadProfiles() {
  try {
    const snap = await getDocs(collection(db, "profiles"));
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error("loadProfiles error:", e);
    return [];
  }
}

async function saveProfiles(profiles) {
  try {
    await Promise.all(profiles.map(p => setDoc(doc(db, "profiles", p.id), p)));
    return true;
  } catch (e) {
    console.error("saveProfiles error:", e);
    return false;
  }
}

async function saveOneProfile(profile) {
  try {
    await setDoc(doc(db, "profiles", profile.id), profile);
    return true;
  } catch (e) {
    console.error("saveOneProfile error:", e);
    return false;
  }
}

async function deleteProfileDoc(id) {
  try {
    await deleteDoc(doc(db, "profiles", id));
  } catch (e) {
    console.error("deleteProfile error:", e);
  }
}

async function loadMatches() {
  try {
    const snap = await getDocs(collection(db, "matches"));
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error("loadMatches error:", e);
    return [];
  }
}

async function saveMatches(matches) {
  try {
    await Promise.all(matches.map(m => setDoc(doc(db, "matches", m.id), m)));
  } catch (e) {
    console.error("saveMatches error:", e);
  }
}

// ---------- UI Primitives ----------
function Field({ label, children, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 20 }}>
      <span style={{
        display: "block", fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase",
        color: COLORS.inkSoft, marginBottom: 8, fontWeight: 600
      }}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", fontSize: 12, color: COLORS.inkSoft, marginTop: 6 }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 8,
  border: `1px solid ${COLORS.creamDark}`, background: "#fff", color: COLORS.ink,
  outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box",
};

function TextInput(props) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
      style={{ ...inputStyle, ...(focus ? { borderColor: COLORS.gold, boxShadow: `0 0 0 3px ${COLORS.goldLight}55` } : {}), ...(props.style || {}) }}
    />
  );
}

function Select({ value, onChange, options, placeholder }) {
  const [focus, setFocus] = useState(false);
  return (
    <select
      value={value || ""}
      onChange={onChange}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{ ...inputStyle, ...(focus ? { borderColor: COLORS.gold, boxShadow: `0 0 0 3px ${COLORS.goldLight}55` } : {}), cursor: "pointer" }}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 16px", borderRadius: 20, fontSize: 13.5, fontWeight: 500,
        border: `1.5px solid ${active ? COLORS.bordeaux : COLORS.creamDark}`,
        background: active ? COLORS.bordeaux : "#fff",
        color: active ? "#fff" : COLORS.inkSoft,
        cursor: "pointer", transition: "all 0.15s ease", margin: "0 6px 8px 0",
      }}
    >
      {children}
    </button>
  );
}

function Button({ children, onClick, variant = "primary", style, type = "button", disabled }) {
  const base = {
    padding: "13px 28px", borderRadius: 8, fontSize: 14.5, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", border: "none",
    display: "inline-flex", alignItems: "center", gap: 8,
    transition: "transform 0.1s ease, opacity 0.15s ease", opacity: disabled ? 0.5 : 1,
    fontFamily: "Inter, sans-serif",
  };
  const variants = {
    primary: { background: COLORS.bordeaux, color: "#fff" },
    secondary: { background: "transparent", color: COLORS.bordeaux, border: `1.5px solid ${COLORS.bordeaux}` },
    ghost: { background: "transparent", color: COLORS.inkSoft },
    gold: { background: COLORS.gold, color: COLORS.bordeauxDark },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

function ScoreRing({ score }) {
  const color = score >= 70 ? "#3D7A5C" : score >= 40 ? COLORS.gold : COLORS.inkSoft;
  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="none" stroke={COLORS.creamDark} strokeWidth="5" />
        <circle
          cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${(score / 100) * 150.8} 150.8`}
          strokeLinecap="round" transform="rotate(-90 28 28)"
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, color: COLORS.ink, fontFamily: "ui-monospace, monospace"
      }}>{score}</div>
    </div>
  );
}

function Avatar({ photo, name, size = 48 }) {
  if (photo) {
    return <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${COLORS.goldLight}` }} />;
  }
  const initial = (name || "?").trim()[0]?.toUpperCase() || "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: COLORS.bordeaux, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 700,
      fontFamily: "Playfair Display, serif", flexShrink: 0
    }}>{initial}</div>
  );
}

// ---------- NationalityPicker ----------
function NationalityPicker({ selected, onToggle, pays, placeholder }) {
  const [search, setSearch] = useState("");
  const filtered = pays.filter(p => p.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      {selected.length > 0 && (
        <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selected.map(s => (
            <span key={s} onClick={() => onToggle(s)} style={{
              background: COLORS.bordeaux, color: "#fff", fontSize: 12, padding: "4px 10px",
              borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
            }}>
              {s} <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
            </span>
          ))}
        </div>
      )}
      {selected.length === 0 && placeholder && (
        <p style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 }}>{placeholder}</p>
      )}
      <TextInput
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un pays..."
        style={{ marginBottom: 8 }}
      />
      {search.length > 0 && (
        <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${COLORS.creamDark}`, borderRadius: 8, background: "#fff" }}>
          {filtered.length === 0 ? (
            <p style={{ padding: "10px 14px", fontSize: 13, color: COLORS.inkSoft }}>Aucun pays trouvé</p>
          ) : filtered.map(p => (
            <div key={p} onClick={() => { onToggle(p); setSearch(""); }} style={{
              padding: "9px 14px", fontSize: 13.5, cursor: "pointer", color: COLORS.ink,
              background: selected.includes(p) ? COLORS.cream : "#fff",
              borderBottom: `1px solid ${COLORS.cream}`,
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              {p}
              {selected.includes(p) && <span style={{ color: COLORS.bordeaux, fontSize: 16 }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Registration Form ----------
function RegistrationForm({ onSubmit, onCancel, adminMode = false }) {
  const [form, setForm] = useState({
    firstName: "", age: "", gender: "", city: "", country: "", email: "", phone: "", nationalities: [], situation: "", hasChildren: "", numberOfChildren: "", childrenAges: "", wantsChildren: "",
    religion: "", profession: "", educationLevel: "", smoker: "", lifestyle: "", housingStatus: "", availability: "", morphology: "", lookingForMorphology: "", lookingForNationalities: [],
    interests: [], lookingForGender: "", ageMin: "", ageMax: "",
    height: "", lookingForHeightMin: "", lookingForHeightMax: "", acceptedZones: [],
    dealbreakers: "", selfDescription: "", whyAgency: "",
    about: "", photo: null, photoFull: null, subscriptionPlanId: null, contractAccepted: false, promoCode: "", paymentMethod: "", paymentProvider: "", paymentReference: "", paymentSelfConfirmed: false,
    selectedCountries: [],
  });
  const [step, setStep] = useState(0);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFullPreview, setPhotoFullPreview] = useState(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleInterest = (i) => setForm(f => ({
    ...f, interests: f.interests.includes(i) ? f.interests.filter(x => x !== i) : [...f.interests, i]
  }));
  const toggleZone = (z) => setForm(f => ({
    ...f, acceptedZones: f.acceptedZones.includes(z) ? f.acceptedZones.filter(x => x !== z) : [...f.acceptedZones, z]
  }));
  const toggleNationality = (n) => setForm(f => ({
    ...f, nationalities: f.nationalities.includes(n) ? f.nationalities.filter(x => x !== n) : [...f.nationalities, n]
  }));
  const toggleLookingForNationality = (n) => setForm(f => ({
    ...f, lookingForNationalities: f.lookingForNationalities.includes(n) ? f.lookingForNationalities.filter(x => x !== n) : [...f.lookingForNationalities, n]
  }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 480;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.5);
        setPhotoPreview(compressed);
        set("photo", compressed);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoFull = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 480;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.5);
        setPhotoFullPreview(compressed);
        set("photoFull", compressed);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.id === form.subscriptionPlanId);
  const isFreeCode = !!(form.promoCode && FREE_ACCESS_CODES.includes(form.promoCode.trim()));
  const chosenPaymentLink = form.paymentProvider === "stripe" ? selectedPlan?.stripeLink : form.paymentProvider === "paypal" ? selectedPlan?.paypalLink : null;

  const steps = adminMode ? [
    { key: "info", title: "Vos informations", icon: User },
    { key: "criteria", title: "Vos critères de vie", icon: MapPin },
    { key: "personality", title: "Votre personnalité", icon: Sparkles },
    { key: "interests", title: "Vos centres d interet", icon: Heart },
    { key: "lookingfor", title: "Ce que vous recherchez", icon: Heart },
  ] : [
    { key: "plan", title: "Choisissez votre formule", icon: Lock },
    { key: "payment", title: "Contrat et paiement", icon: Check },
    { key: "info", title: "Vos informations", icon: User },
    { key: "criteria", title: "Vos critères de vie", icon: MapPin },
    { key: "personality", title: "Votre personnalité", icon: Sparkles },
    { key: "interests", title: "Vos centres d interet", icon: Heart },
    { key: "lookingfor", title: "Ce que vous recherchez", icon: Heart },
  ];

  // Le paiement (ou un code promo valide) est obligatoire pour valider l'inscription
  const paymentSatisfied = () => {
    if (isFreeCode) return true;
    if (!form.paymentMethod) return false;
    return !!form.paymentSelfConfirmed;
  };

  const currentKey = steps[step].key;

  const canNext = () => {
    if (currentKey === "plan") return !!form.subscriptionPlanId;
    if (currentKey === "payment") return !!form.contractAccepted && paymentSatisfied();
    if (currentKey === "info") return form.firstName && form.age && form.gender && form.photo && form.photoFull && form.profession && form.height && form.email && form.phone && form.morphology;
    if (currentKey === "criteria") return form.city && form.country && form.situation && form.hasChildren && form.wantsChildren;
    if (currentKey === "personality") return true;
    if (currentKey === "interests") return form.interests.length > 0;
    if (currentKey === "lookingfor") return form.lookingForGender && form.ageMin && form.ageMax;
    return true;
  };

  const handleSubmit = () => {
    const now = Date.now();
    if (adminMode) {
      onSubmit({
        ...form, id: uid(), status: "en_attente", createdAt: now,
        subscriptionStartedAt: now,
        subscriptionExpiresAt: addMonths(now, 12),
        subscriptionPrice: 0,
        subscriptionPlanLabel: "Profil ajouté manuellement (gratuit)",
        isVip: false,
        addedManually: true,
        contractAcceptedAt: null,
      });
      return;
    }
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === form.subscriptionPlanId);
    onSubmit({
      ...form, id: uid(), status: "en_attente", createdAt: now,
      subscriptionStartedAt: now,
      subscriptionExpiresAt: addMonths(now, plan.months),
      subscriptionPrice: isFreeCode ? 0 : plan?.price,
      subscriptionPlanLabel: `${plan?.vip ? "VIP " : plan.label + " "}${plan.months} mois${isFreeCode ? " (code promo)" : ""}`,
      isVip: !!plan?.vip,
      contractAcceptedAt: now,
      paidViaPromoCode: !!isFreeCode,
    });
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 36 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= step ? COLORS.gold : COLORS.creamDark, transition: "background 0.3s"
          }} />
        ))}
      </div>

      <div style={{ marginBottom: 28 }}>
        <span style={{ fontSize: 13, color: COLORS.gold, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Étape {step + 1} sur {steps.length}
        </span>
        <h2 style={{
          fontFamily: "Playfair Display, serif", fontSize: 28, color: COLORS.bordeauxDark, margin: "6px 0 0"
        }}>{steps[step].title}</h2>
      </div>

      {currentKey === "info" && (
        <>
          <Field label="Prénom">
            <TextInput value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Votre prénom" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Age">
              <TextInput type="number" value={form.age} onChange={e => set("age", e.target.value)} placeholder="35" />
            </Field>
            <Field label="Genre">
              <Select value={form.gender} onChange={e => set("gender", e.target.value)} placeholder="Choisir" options={["Femme", "Homme"]} />
            </Field>
          </div>
          <Field label="Email *">
            <TextInput type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="votre@email.com" />
          </Field>
          <Field label="Telephone *">
            <TextInput type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+33 6 00 00 00 00" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Taille (en cm) *">
              <TextInput type="number" value={form.height} onChange={e => set("height", e.target.value)} placeholder="170" />
            </Field>
            <Field label="Profession *">
              <TextInput value={form.profession} onChange={e => set("profession", e.target.value)} placeholder="Votre métier" />
            </Field>
          </div>
          <Field label="Votre morphologie *" hint="Comment decririez-vous votre silhouette ?">
            <Select value={form.morphology} onChange={e => set("morphology", e.target.value)} placeholder="Choisir" options={["Mince", "Svelte / athletique", "Sportif(ve)", "Corpulent(e) / rond(e)", "En surpoids", "Peu importe"]} />
          </Field>
          <Field label="Mettez une photo de profil *" hint="Visible uniquement par l agence, puis par votre futur match valide">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar photo={photoPreview} name={form.firstName} size={64} />
              <label style={{
                padding: "10px 18px", borderRadius: 8,
                border: `1.5px dashed ${!form.photo ? "#A33" : COLORS.gold}`,
                color: COLORS.bordeaux, fontSize: 14, fontWeight: 600, cursor: "pointer"
              }}>
                Choisir une photo de visage
                <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
              </label>
            </div>
            {!form.photo && (
              <span style={{ display: "block", fontSize: 12.5, color: "#A33", marginTop: 8 }}>
                Une photo de visage est obligatoire.
              </span>
            )}
          </Field>

          <Field label="Mettez une photo de vous entière *" hint="Permet une meilleure mise en relation">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar photo={photoFullPreview} name={form.firstName} size={64} />
              <label style={{
                padding: "10px 18px", borderRadius: 8,
                border: `1.5px dashed ${!form.photoFull ? "#A33" : COLORS.gold}`,
                color: COLORS.bordeaux, fontSize: 14, fontWeight: 600, cursor: "pointer"
              }}>
                Choisir une photo en pied
                <input type="file" accept="image/*" onChange={handlePhotoFull} style={{ display: "none" }} />
              </label>
            </div>
            {!form.photoFull && (
              <span style={{ display: "block", fontSize: 12.5, color: "#A33", marginTop: 8 }}>
                Une photo en pied est obligatoire.
              </span>
            )}
          </Field>
        </>
      )}

      {currentKey === "criteria" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Ville">
              <TextInput value={form.city} onChange={e => set("city", e.target.value)} placeholder="Votre ville" />
            </Field>
            <Field label="Pays de residence">
              <TextInput value={form.country} onChange={e => set("country", e.target.value)} placeholder="France" />
            </Field>
          </div>
          <Field label="Votre nationalite" hint="Selectionnez une ou plusieurs nationalites">
            <NationalityPicker selected={form.nationalities} onToggle={toggleNationality} pays={TOUS_LES_PAYS} />
          </Field>
          <Field label="Situation familiale">
            <Select value={form.situation} onChange={e => set("situation", e.target.value)} placeholder="Choisir" options={SITUATIONS} />
          </Field>
          <Field label="Avez-vous des enfants ?">
            <Select value={form.hasChildren} onChange={e => set("hasChildren", e.target.value)} placeholder="Choisir" options={["Oui", "Non"]} />
          </Field>
          {form.hasChildren === "Oui" && (
            <>
              <Field label="Combien d enfants ?">
                <TextInput type="number" value={form.numberOfChildren} onChange={e => set("numberOfChildren", e.target.value)} placeholder="2" />
              </Field>
              <Field label="Âge(s) des enfants" hint="Ex : 4 et 9 ans">
                <TextInput value={form.childrenAges} onChange={e => set("childrenAges", e.target.value)} placeholder="4 et 9 ans" />
              </Field>
            </>
          )}
          <Field label="Désirez-vous encore des enfants ?">
            <Select value={form.wantsChildren} onChange={e => set("wantsChildren", e.target.value)} placeholder="Choisir" options={["Oui", "Non", "Peu importe"]} />
          </Field>
          <Field label="Religion" hint="Facultatif, utilise seulement si c est important pour vous">
            <Select value={form.religion} onChange={e => set("religion", e.target.value)} placeholder="Choisir" options={RELIGIONS} />
          </Field>
        </>
      )}

      {currentKey === "personality" && (
        <>
          <Field label="Niveau d etudes" hint="Facultatif">
            <Select value={form.educationLevel} onChange={e => set("educationLevel", e.target.value)} placeholder="Choisir" options={["Brevet / CAP / BEP", "Baccalauréat", "Bac+2 / BTS / DUT", "Bac+3 / Licence", "Bac+5 / Master", "Doctorat / Grande école", "Autre"]} />
          </Field>
          <Field label="Fumeur / Fumeuse ?">
            <Select value={form.smoker} onChange={e => set("smoker", e.target.value)} placeholder="Choisir" options={["Non fumeur(se)", "Fumeur(se)", "Fumeur(se) occasionnel(le)", "En cours d'arrêt"]} />
          </Field>
          <Field label="Situation de logement" hint="Facultatif">
            <Select value={form.housingStatus} onChange={e => set("housingStatus", e.target.value)} placeholder="Choisir" options={["Propriétaire", "Locataire", "Heberge chez un proche", "Autre"]} />
          </Field>
          <Field label="Consommez-vous de l alcool ?">
            <Select value={form.availability} onChange={e => set("availability", e.target.value)} placeholder="Choisir" options={["Non, jamais", "Occasionnellement", "Oui, regulierement"]} />
          </Field>
          <Field label="Décrivez-vous en quelques mots" hint="Facultatif">
            <textarea
              value={form.selfDescription} onChange={e => set("selfDescription", e.target.value)}
              placeholder="Ex : Je suis quelqu'un de calme, attentionne(e)..."
              style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "Inter, sans-serif" }}
            />
          </Field>
          <Field label="Ce qui est redhibitoire pour vous" hint="Facultatif">
            <textarea
              value={form.dealbreakers} onChange={e => set("dealbreakers", e.target.value)}
              placeholder="Ex : Je ne souhaite pas quelqu'un qui fume..."
              style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "Inter, sans-serif" }}
            />
          </Field>
          <Field label="Pourquoi faire appel a une agence ?" hint="Facultatif">
            <Select value={form.whyAgency} onChange={e => set("whyAgency", e.target.value)} placeholder="Choisir" options={["Manque de temps pour chercher seul", "Les applis de rencontre ne me conviennent pas", "Je veux une demarche serieuse et encadree", "Recommande par un proche", "Autre"]} />
          </Field>
        </>
      )}

      {currentKey === "interests" && (
        <Field label="Sélectionnez ce qui vous correspond" hint="Choisissez-en plusieurs">
          <div style={{ marginTop: 4 }}>
            {INTERESTS.map(i => (
              <Pill key={i} active={form.interests.includes(i)} onClick={() => toggleInterest(i)}>{i}</Pill>
            ))}
          </div>
        </Field>
      )}

      {currentKey === "lookingfor" && (
        <>
          <Field label="Vous recherchez">
            <Select value={form.lookingForGender} onChange={e => set("lookingForGender", e.target.value)} placeholder="Choisir" options={["Femme", "Homme", "Peu importe"]} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Âge minimum">
              <TextInput type="number" value={form.ageMin} onChange={e => set("ageMin", e.target.value)} placeholder="28" />
            </Field>
            <Field label="Âge maximum">
              <TextInput type="number" value={form.ageMax} onChange={e => set("ageMax", e.target.value)} placeholder="45" />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Taille minimum (cm)" hint="Facultatif">
              <TextInput type="number" value={form.lookingForHeightMin} onChange={e => set("lookingForHeightMin", e.target.value)} placeholder="165" />
            </Field>
            <Field label="Taille maximum (cm)" hint="Facultatif">
              <TextInput type="number" value={form.lookingForHeightMax} onChange={e => set("lookingForHeightMax", e.target.value)} placeholder="195" />
            </Field>
          </div>
          <Field label="Type physique recherche" hint="Facultatif">
            <Select value={form.lookingForMorphology} onChange={e => set("lookingForMorphology", e.target.value)} placeholder="Choisir" options={["Mince", "Svelte / athletique", "Sportif(ve)", "Corpulent(e) / rond(e)", "Peu importe"]} />
          </Field>
          <Field label="Nationalite recherchee" hint="Facultatif - laissez vide si peu importe">
            <NationalityPicker selected={form.lookingForNationalities} onToggle={toggleLookingForNationality} pays={TOUS_LES_PAYS} placeholder="Toutes nationalites acceptees" />
          </Field>
          <Field label="Zones geographiques acceptees" hint="Selectionnez les zones">
            <div style={{ marginTop: 4 }}>
              {ZONES.map(z => (
                <Pill key={z} active={form.acceptedZones.includes(z)} onClick={() => toggleZone(z)}>{z}</Pill>
              ))}
            </div>
          </Field>
          <Field label="Quelques mots sur vous ou ce que vous recherchez" hint="Facultatif">
            <textarea
              value={form.about} onChange={e => set("about", e.target.value)}
              placeholder="Ce qui compte pour vous chez l autre..."
              style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "Inter, sans-serif" }}
            />
          </Field>
        </>
      )}

      {currentKey === "plan" && (
        <Field label="Sélectionnez votre formule" hint="Votre profil sera actif pendant toute la durée choisie">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            {SUBSCRIPTION_PLANS.filter(p => !p.vip).map(plan => {
              const active = form.subscriptionPlanId === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => set("subscriptionPlanId", plan.id)}
                  style={{
                    padding: "18px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                    border: `2px solid ${active ? COLORS.bordeaux : COLORS.creamDark}`,
                    background: active ? COLORS.cream : "#fff",
                  }}
                >
                  <div style={{ fontSize: 13, color: COLORS.bordeaux, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {plan.label}
                  </div>
                  <div style={{ fontSize: 12.5, color: COLORS.inkSoft, fontWeight: 600, textTransform: "uppercase", marginTop: 2 }}>
                    {plan.months} mois
                  </div>
                  <div style={{ fontFamily: "Playfair Display, serif", fontSize: 24, color: COLORS.bordeauxDark, marginTop: 4 }}>
                    {plan.price} €
                  </div>
                  <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 6 }}>{plan.profiles}</div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 22, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.gold, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Formule accompagnement personnalisé
            </span>
          </div>
          {SUBSCRIPTION_PLANS.filter(p => p.vip).map(plan => {
            const active = form.subscriptionPlanId === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => set("subscriptionPlanId", plan.id)}
                style={{
                  width: "100%", padding: "20px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                  border: `2px solid ${active ? COLORS.gold : COLORS.creamDark}`,
                  background: active ? COLORS.goldLight + "33" : "#fff",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: COLORS.bordeaux, fontWeight: 700, textTransform: "uppercase" }}>
                    VIP · {plan.months} mois
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 4 }}>{plan.profiles}</div>
                  <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 4, maxWidth: 320 }}>{plan.description}</div>
                </div>
                <div style={{ fontFamily: "Playfair Display, serif", fontSize: 26, color: COLORS.bordeauxDark, whiteSpace: "nowrap" }}>
                  {plan.price} €
                </div>
              </button>
            );
          })}
        </Field>
      )}

      {currentKey === "payment" && (() => {
        const plan = SUBSCRIPTION_PLANS.find(p => p.id === form.subscriptionPlanId);
        return (
          <>
            <div style={{
              background: "#fff", border: `1px solid ${COLORS.creamDark}`, borderRadius: 12,
              padding: 22, maxHeight: 320, overflowY: "auto", fontSize: 13.5, color: COLORS.ink, lineHeight: 1.7
            }}>
              <h4 style={{ fontFamily: "Playfair Display, serif", fontSize: 17, color: COLORS.bordeauxDark, marginTop: 0 }}>
                Contrat de mise en relation - {AGENCY_NAME}
              </h4>
              <p><strong>1. Objet.</strong> {AGENCY_NAME} propose un service de mise en relation entre personnes célibataires, sur la base des critères déclarés par le client lors de son inscription.</p>
              <p><strong>2. Formule souscrite.</strong> {plan ? `${plan.vip ? "VIP " : ""}${plan.months} mois - ${plan.profiles} - ${plan.price} €` : "-"}.{plan?.vip && " La formule VIP comprend : (a) un entretien personnalisé en présentiel entre le client et l'agence, proposé uniquement aux clients résidant en France métropolitaine ; (b) l'organisation logistique des deux premiers rendez-vous de mise en relation. Lors de ces rendez-vous, l'agence n'est pas présente."}</p>
              <p><strong>3. Obligation de moyens.</strong> {AGENCY_NAME} s'engage à mettre en œuvre les moyens nécessaires à la recherche de profils compatibles. {AGENCY_NAME} n'a pas d'obligation de résultat.</p>
              <p><strong>4. Confidentialité.</strong> Les informations et la photo transmises restent strictement confidentielles et ne sont communiquées à un autre client qu'après validation d'une mise en relation par {AGENCY_NAME}.</p>
              <p><strong>5. Durée et expiration.</strong> L'abonnement est valable pour la durée choisie à compter de la date de paiement.</p>
              <p><strong>6. Droit de rétractation.</strong> Le client dispose d'un délai de rétractation après la signature du présent contrat, sauf début d'exécution expressément demandé.</p>
              <p><strong>7. Aucune garantie de résultat.</strong> Le nombre de profils ou de mises en relation indiqué constitue un engagement de moyens, non une garantie de relation.</p>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 18, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.contractAccepted}
                onChange={e => set("contractAccepted", e.target.checked)}
                style={{ marginTop: 3, width: 17, height: 17, cursor: "pointer", accentColor: COLORS.bordeaux }}
              />
              <span style={{ fontSize: 14, color: COLORS.ink }}>
                J'ai lu et j'accepte les termes du contrat ci-dessus. Je comprends que mon paiement valide mon inscription auprès de {AGENCY_NAME}.
              </span>
            </label>

            {/* ---- Code promo (bypass paiement) ---- */}
            <div style={{ marginTop: 22 }}>
              <Field label="Code promo" hint="Si l'agence vous en a fourni un">
                <TextInput
                  value={form.promoCode}
                  onChange={e => set("promoCode", e.target.value.toUpperCase())}
                  placeholder="Ex : BIENVENUE2026"
                />
              </Field>
              {isFreeCode && (
                <div style={{
                  background: "#E8F3EC", border: "1px solid #B8E0C6", borderRadius: 8,
                  padding: "12px 14px", fontSize: 13.5, color: "#2D5C3F"
                }}>
                  Code valide — votre inscription sera gratuite, sans paiement à effectuer.
                </div>
              )}
            </div>

            {/* ---- Paiement (obligatoire si pas de code promo valide) ---- */}
            {!isFreeCode && (
              <div style={{ marginTop: 22 }}>
                <Field label="Moyen de paiement">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => { set("paymentMethod", "card"); set("paymentReference", ""); set("paymentSelfConfirmed", false); setPaymentConfirmed(false); }}
                      style={{
                        padding: "16px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                        border: `2px solid ${form.paymentMethod === "card" ? COLORS.bordeaux : COLORS.creamDark}`,
                        background: form.paymentMethod === "card" ? COLORS.cream : "#fff",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>Carte bancaire / PayPal</div>
                      <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 3 }}>France, Europe, international</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { set("paymentMethod", "mobile_money"); set("paymentReference", ""); set("paymentSelfConfirmed", false); setPaymentConfirmed(false); }}
                      style={{
                        padding: "16px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                        border: `2px solid ${form.paymentMethod === "mobile_money" ? COLORS.bordeaux : COLORS.creamDark}`,
                        background: form.paymentMethod === "mobile_money" ? COLORS.cream : "#fff",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>Mobile Money</div>
                      <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 3 }}>Orange Money, MTN, Wave, Moov...</div>
                    </button>
                  </div>
                </Field>

                {form.paymentMethod === "card" && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                      <button
                        type="button"
                        onClick={() => set("paymentProvider", "stripe")}
                        disabled={!plan?.stripeLink}
                        style={{
                          padding: "12px", borderRadius: 8, textAlign: "center", cursor: plan?.stripeLink ? "pointer" : "not-allowed",
                          border: `2px solid ${form.paymentProvider === "stripe" ? COLORS.bordeaux : COLORS.creamDark}`,
                          background: form.paymentProvider === "stripe" ? COLORS.cream : "#fff",
                          opacity: plan?.stripeLink ? 1 : 0.45, fontSize: 14, fontWeight: 600, color: COLORS.ink,
                        }}
                      >
                        Payer par Stripe
                      </button>
                      <button
                        type="button"
                        onClick={() => set("paymentProvider", "paypal")}
                        disabled={!plan?.paypalLink}
                        style={{
                          padding: "12px", borderRadius: 8, textAlign: "center", cursor: plan?.paypalLink ? "pointer" : "not-allowed",
                          border: `2px solid ${form.paymentProvider === "paypal" ? COLORS.bordeaux : COLORS.creamDark}`,
                          background: form.paymentProvider === "paypal" ? COLORS.cream : "#fff",
                          opacity: plan?.paypalLink ? 1 : 0.45, fontSize: 14, fontWeight: 600, color: COLORS.ink,
                        }}
                      >
                        Payer par PayPal
                      </button>
                    </div>

                    {form.paymentProvider && chosenPaymentLink && !paymentConfirmed && (
                      <>
                        <Button
                          onClick={() => { window.open(chosenPaymentLink, "_blank"); setPaymentConfirmed(true); }}
                          variant="gold"
                          style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
                        >
                          Procéder au paiement ({selectedPlan?.price} €)
                        </Button>
                        <p style={{ fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 12 }}>
                          Une nouvelle page va s'ouvrir pour entrer votre carte bancaire. Si rien ne s'ouvre, vérifiez que votre navigateur n'a pas bloqué la fenêtre (icône de blocage pop-up dans la barre d'adresse).
                        </p>
                      </>
                    )}
                    {form.paymentProvider && !chosenPaymentLink && (
                      <div style={{
                        background: "#FBF6EA", border: `1px solid ${COLORS.goldLight}`, borderRadius: 8,
                        padding: "12px 14px", fontSize: 13, color: COLORS.bordeauxDark, marginBottom: 12
                      }}>
                        Ce moyen de paiement n'est pas encore activé pour cette formule. Contactez l'agence.
                      </div>
                    )}

                    {form.paymentProvider && chosenPaymentLink && paymentConfirmed && (
                      <>
                        <div style={{
                          background: "#E8F3EC", border: "1px solid #B8E0C6", borderRadius: 8,
                          padding: "12px 14px", fontSize: 13, color: "#2D5C3F", marginBottom: 14
                        }}>
                          Une fois votre paiement terminé sur la page qui s'est ouverte, confirmez ci-dessous pour valider votre inscription.
                        </div>
                        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={!!form.paymentSelfConfirmed}
                            onChange={e => set("paymentSelfConfirmed", e.target.checked)}
                            style={{ marginTop: 3, width: 17, height: 17, cursor: "pointer", accentColor: COLORS.bordeaux }}
                          />
                          <span style={{ fontSize: 14, color: COLORS.ink }}>
                            Je confirme avoir effectué le paiement de {selectedPlan?.price} €.
                          </span>
                        </label>
                        <Field label="Référence de paiement" hint="Facultatif — si vous l'avez sous la main, ça aide l'agence à vérifier plus vite">
                          <TextInput
                            value={form.paymentReference || ""}
                            onChange={e => set("paymentReference", e.target.value)}
                            placeholder="cs_live_xxxxxxxxxxxx"
                          />
                        </Field>
                        <Button variant="ghost" onClick={() => setPaymentConfirmed(false)} style={{ fontSize: 12.5, padding: "4px 0" }}>
                          Rouvrir la page de paiement
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {form.paymentMethod === "mobile_money" && (
                  <div>
                    <div style={{
                      background: "#FBF6EA", border: `1px solid ${COLORS.goldLight}`, borderRadius: 8,
                      padding: "12px 14px", fontSize: 13, color: COLORS.bordeauxDark, marginBottom: 16
                    }}>
                      Envoyez {selectedPlan?.price} € au numéro Mobile Money communiqué par l'agence.
                    </div>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!!form.paymentSelfConfirmed}
                        onChange={e => set("paymentSelfConfirmed", e.target.checked)}
                        style={{ marginTop: 3, width: 17, height: 17, cursor: "pointer", accentColor: COLORS.bordeaux }}
                      />
                      <span style={{ fontSize: 14, color: COLORS.ink }}>
                        Je confirme avoir envoyé le paiement de {selectedPlan?.price} €.
                      </span>
                    </label>
                    <Field label="Numéro de transaction Mobile Money" hint="Facultatif — reçu par SMS, si vous l'avez">
                      <TextInput
                        value={form.paymentReference || ""}
                        onChange={e => set("paymentReference", e.target.value)}
                        placeholder="Ex : MP240712.1234.A56789"
                      />
                    </Field>
                  </div>
                )}

                {!form.paymentMethod && (
                  <p style={{ fontSize: 13, color: COLORS.inkSoft }}>Choisissez un moyen de paiement pour continuer, ou entrez un code promo valide ci-dessus.</p>
                )}
              </div>
            )}
          </>
        );
      })()}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 36 }}>
        <Button variant="ghost" onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}>
          <ArrowLeft size={16} /> {step === 0 ? "Annuler" : "Précédent"}
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()}>
            Continuer <ChevronRight size={16} />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canNext()} variant="gold">
            <Check size={16} /> {adminMode ? "Ajouter ce profil" : "Envoyer mon profil"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------- Admin Login ----------
function AdminLogin({ onLogin }) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);

  const handle = () => {
    if (pwd.length > 0) { onLogin(pwd); }
  };

  return (
    <div style={{ maxWidth: 380, margin: "80px auto", textAlign: "center", padding: "0 20px" }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: COLORS.bordeaux, margin: "0 auto 20px",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <Lock size={24} color="#fff" />
      </div>
      <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 26, color: COLORS.bordeauxDark, marginBottom: 6 }}>
        Espace agence
      </h2>
      <p style={{ color: COLORS.inkSoft, fontSize: 14, marginBottom: 28 }}>Accès réservé. Entrez votre mot de passe.</p>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <TextInput
          type={show ? "text" : "password"}
          value={pwd}
          onChange={e => { setPwd(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && handle()}
          placeholder="Mot de passe"
          style={{ paddingRight: 44 }}
        />
        <button onClick={() => setShow(s => !s)} style={{
          position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft
        }}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p style={{ color: "#A33", fontSize: 13, marginBottom: 12 }}>Mot de passe incorrect.</p>}
      <Button onClick={handle} style={{ width: "100%", justifyContent: "center" }}>Se connecter</Button>
    </div>
  );
}

// ---------- Profile detail modal ----------
function downloadProfileAsPdf(profile) {
  const win = window.open("", "_blank");
  if (!win) return;
  const interestsHtml = (profile.interests || []).map(i => `<span style="display:inline-block;border:1px solid #C9A86A;border-radius:14px;padding:4px 12px;margin:0 6px 6px 0;font-size:12.5px;color:#5C1A2B;">${i}</span>`).join("");
  const row = (label, value) => value ? `<tr><td style="padding:8px 0;color:#6B5F58;font-size:13px;width:170px;border-bottom:1px solid #F0E9DD;">${label}</td><td style="padding:8px 0;color:#2A2422;font-size:14px;font-weight:500;border-bottom:1px solid #F0E9DD;">${value}</td></tr>` : "";
  const html = `
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Fiche ${profile.firstName}</title>
      <style>
        body { font-family: -apple-system, Arial, sans-serif; padding: 40px; color: #2A2422; }
        h1 { font-size: 22px; color: #3D0F1C; margin-bottom: 2px; }
        .sub { color: #6B5F58; font-size: 14px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        .badge-vip { background: #E8D5A8; color: #3D0F1C; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 14px; margin-left: 8px; }
        .about { margin-top: 18px; padding: 14px; background: #FAF6F0; border-radius: 8px; font-style: italic; font-size: 13.5px; }
        .agency { color: #C9A86A; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; margin-bottom: 18px; }
      </style>
    </head>
    <body>
      <div class="agency">${AGENCY_NAME}</div>
      <h1>${profile.firstName}, ${profile.age} ans ${profile.isVip ? '<span class="badge-vip">VIP</span>' : ""}</h1>
      <div class="sub">${profile.city || ""} ${profile.profession ? "· " + profile.profession : ""}</div>
      <table>
        ${row("Genre", profile.gender)}
        ${row("Email", profile.email)}
        ${row("Telephone", profile.phone)}
        ${row("Nationalite", (profile.nationalities || []).join(", ") || profile.nationality || "")}
        ${row("Nationalite recherchee", (profile.lookingForNationalities || []).length > 0 ? profile.lookingForNationalities.join(", ") : "Peu importe")}
        ${row("Ville / Pays", `${profile.city || ""}${profile.country ? " - " + profile.country : ""}`)}
        ${row("Situation", profile.situation)}
        ${row("A des enfants", profile.hasChildren === "Oui" ? `Oui (${profile.numberOfChildren || "?"}, âge${(profile.numberOfChildren || 0) > 1 ? "s" : ""} : ${profile.childrenAges || "non précisé"})` : profile.hasChildren)}
        ${row("Désire encore des enfants", profile.wantsChildren)}
        ${row("Religion", profile.religion)}
        ${row("Niveau d etudes", profile.educationLevel)}
        ${row("Fumeur(se)", profile.smoker)}
        ${row("Logement", profile.housingStatus)}
        ${row("Disponibilité", profile.availability)}
        ${row("Taille", profile.height ? profile.height + " cm" : "")}
        ${row("Morphologie", profile.morphology)}
        ${row("Recherche", `${profile.lookingForGender || ""}, ${profile.ageMin || "?"}-${profile.ageMax || "?"} ans`)}
        ${row("Type physique recherche", profile.lookingForMorphology)}
        ${row("Taille recherchée", (profile.lookingForHeightMin || profile.lookingForHeightMax) ? `${profile.lookingForHeightMin || "-"} à ${profile.lookingForHeightMax || "-"} cm` : "")}
        ${row("Zones acceptées", (profile.acceptedZones || []).join(", "))}
        ${row("Formule", profile.subscriptionPlanLabel)}
        ${row("Statut abonnement", isSubscriptionActive(profile) ? `Actif (${daysRemaining(profile)} j restants)` : "Expiré")}
        ${row("Reference paiement", profile.paymentReference)}
      </table>
      <div style="margin-top:18px;">${interestsHtml}</div>
      ${profile.selfDescription ? `<div class="about">"${profile.selfDescription}"</div>` : ""}
      ${profile.dealbreakers ? `<p style="margin-top:12px;font-size:13px;color:#6B5F58;"><strong>Rédhibitoires :</strong> ${profile.dealbreakers}</p>` : ""}
      ${profile.about ? `<p style="margin-top:8px;font-size:13px;color:#6B5F58;font-style:italic;">${profile.about}</p>` : ""}
    </body>
    </html>
  `;
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

function ProfileCard({ profile, onClose, onSaveNotes }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState({
    adminSituation: profile?.adminSituation || "",
    adminAcceptIrregular: profile?.adminAcceptIrregular || "",
    adminNotes: profile?.adminNotes || "",
  });
  if (!profile) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(42,36,34,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, maxWidth: 420, width: "100%", padding: 32,
        maxHeight: "85vh", overflowY: "auto"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <Avatar photo={profile.photo} name={profile.firstName} size={72} />
            {profile.photoFull && (
              <img src={profile.photoFull} alt="Photo en pied" style={{
                width: 72, height: 96, objectFit: "cover", borderRadius: 8,
                border: `2px solid ${COLORS.goldLight}`
              }} />
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontFamily: "Playfair Display, serif", fontSize: 22, color: COLORS.bordeauxDark, margin: 0 }}>
                {profile.firstName}, {profile.age} ans
              </h3>
              {profile.isVip && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: COLORS.bordeauxDark, background: COLORS.goldLight,
                  padding: "3px 9px", borderRadius: 20, letterSpacing: "0.04em"
                }}>VIP</span>
              )}
            </div>
            <p style={{ color: COLORS.inkSoft, fontSize: 14, margin: "4px 0 0" }}>{profile.city} · {profile.profession || "-"}</p>
          </div>
        </div>
        {profile.isVip && (
          <div style={{
            background: COLORS.goldLight + "33", border: `1px solid ${COLORS.goldLight}`, borderRadius: 10,
            padding: "12px 14px", marginBottom: 16, fontSize: 13.5, color: COLORS.bordeauxDark
          }}>
            Formule VIP - pensez à organiser l'entretien personnalisé en présentiel avec ce client, ainsi que la logistique des deux premiers rendez-vous de mise en relation.
          </div>
        )}
        <DetailRow icon={MapPin} label="Ville / Pays" value={`${profile.city || ""}${profile.country ? " - " + profile.country : ""}`} />
        {(profile.nationalities || []).length > 0 && <DetailRow icon={User} label="Nationalite" value={profile.nationalities.join(", ")} />}
        {profile.nationality && !profile.nationalities && <DetailRow icon={User} label="Nationalite" value={profile.nationality} />}
        {(profile.lookingForNationalities || []).length > 0 && <DetailRow icon={User} label="Nationalite recherchee" value={profile.lookingForNationalities.join(", ")} />}
        {profile.email && <DetailRow icon={User} label="Email" value={profile.email} />}
        {profile.phone && <DetailRow icon={User} label="Telephone" value={profile.phone} />}
        <DetailRow icon={MapPin} label="Situation" value={profile.situation} />
        <DetailRow icon={Heart} label="A des enfants" value={profile.hasChildren === "Oui" ? `Oui (${profile.numberOfChildren || "?"}, âges : ${profile.childrenAges || "non précisé"})` : profile.hasChildren} />
        <DetailRow icon={Heart} label="Désire des enfants" value={profile.wantsChildren} />
        <DetailRow icon={Briefcase} label="Religion" value={profile.religion || "Non précisé"} />
        {profile.educationLevel && <DetailRow icon={Briefcase} label="Études" value={profile.educationLevel} />}
        {profile.smoker && <DetailRow icon={User} label="Fumeur(se)" value={profile.smoker} />}
        {profile.housingStatus && <DetailRow icon={MapPin} label="Logement" value={profile.housingStatus} />}
        {profile.availability && <DetailRow icon={Calendar} label="Disponibilité" value={profile.availability} />}
        <DetailRow icon={Calendar} label="Recherche" value={`${profile.lookingForGender}, ${profile.ageMin}-${profile.ageMax} ans`} />
        {profile.height && <DetailRow icon={User} label="Sa taille" value={`${profile.height} cm`} />}
        {profile.morphology && <DetailRow icon={User} label="Morphologie" value={profile.morphology} />}
        {(profile.lookingForHeightMin || profile.lookingForHeightMax) && (
          <DetailRow icon={User} label="Taille recherchee" value={`${profile.lookingForHeightMin || "-"} a ${profile.lookingForHeightMax || "-"} cm`} />
        )}
        {profile.lookingForMorphology && <DetailRow icon={User} label="Type physique recherche" value={profile.lookingForMorphology} />}
        {(profile.acceptedZones || []).length > 0 && (
          <DetailRow icon={MapPin} label="Zones acceptées" value={profile.acceptedZones.join(", ")} />
        )}
        {profile.paymentReference && (
          <DetailRow icon={Lock} label="Reference paiement" value={profile.paymentReference} />
        )}
        {profile.paidViaPromoCode && (
          <DetailRow icon={Lock} label="Paiement" value="Code promo (gratuit)" />
        )}
        {profile.selfDescription && (
          <div style={{ marginTop: 12, padding: 12, background: COLORS.cream, borderRadius: 8, fontSize: 13.5, fontStyle: "italic", color: COLORS.ink }}>
            "{profile.selfDescription}"
          </div>
        )}
        {profile.dealbreakers && (
          <div style={{ marginTop: 8, fontSize: 13, color: COLORS.inkSoft }}>
            <strong>Rédhibitoires :</strong> {profile.dealbreakers}
          </div>
        )}
        {profile.subscriptionExpiresAt && (
          <DetailRow
            icon={Lock}
            label="Abonnement"
            value={isSubscriptionActive(profile)
              ? `Actif · ${daysRemaining(profile)} jours restants`
              : `Expiré le ${new Date(profile.subscriptionExpiresAt).toLocaleDateString("fr-FR")}`}
          />
        )}
        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em" }}>Centres d'intérêt</span>
          <div style={{ marginTop: 10 }}>
            {(profile.interests || []).map(i => <Pill key={i} active onClick={() => {}}>{i}</Pill>)}
          </div>
        </div>
        {profile.about && (
          <div style={{ marginTop: 16, padding: 14, background: COLORS.cream, borderRadius: 10, fontSize: 14, color: COLORS.ink, fontStyle: "italic" }}>
            "{profile.about}"
          </div>
        )}
        <div style={{
          marginTop: 20, padding: 16, background: "#FFF8E7",
          border: `1px solid ${COLORS.goldLight}`, borderRadius: 10
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.bordeauxDark, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Notes privees (agence uniquement)
            </span>
            <Button variant="ghost" onClick={() => setEditingNotes(!editingNotes)} style={{ fontSize: 12, padding: "4px 10px" }}>
              {editingNotes ? "Annuler" : "Modifier"}
            </Button>
          </div>

          {editingNotes ? (
            <>
              <Field label="Situation administrative">
                <Select
                  value={notes.adminSituation}
                  onChange={e => setNotes(n => ({ ...n, adminSituation: e.target.value }))}
                  placeholder="Choisir"
                  options={["Reguliere", "Irreguliere", "En cours de regularisation", "Non precise"]}
                />
              </Field>
              <Field label="Accepte une relation avec quelqu'un en situation irreguliere ?">
                <Select
                  value={notes.adminAcceptIrregular}
                  onChange={e => setNotes(n => ({ ...n, adminAcceptIrregular: e.target.value }))}
                  placeholder="Choisir"
                  options={["Oui", "Non", "Peu importe"]}
                />
              </Field>
              <Field label="Notes libres (entretien, observations...)">
                <textarea
                  value={notes.adminNotes}
                  onChange={e => setNotes(n => ({ ...n, adminNotes: e.target.value }))}
                  placeholder="Notes confidentielles apres entretien..."
                  style={{ width: "100%", minHeight: 80, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.creamDark}`, fontSize: 13.5, fontFamily: "Inter, sans-serif", resize: "vertical", boxSizing: "border-box" }}
                />
              </Field>
              <Button onClick={() => { onSaveNotes(profile.id, notes); setEditingNotes(false); }} variant="gold" style={{ width: "100%", justifyContent: "center" }}>
                Sauvegarder les notes
              </Button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: COLORS.ink, marginBottom: 6 }}>
                <span style={{ color: COLORS.inkSoft }}>Situation : </span>
                <strong>{profile.adminSituation || "Non renseignee"}</strong>
              </div>
              <div style={{ fontSize: 13, color: COLORS.ink, marginBottom: 6 }}>
                <span style={{ color: COLORS.inkSoft }}>Accepte situation irreguliere : </span>
                <strong>{profile.adminAcceptIrregular || "Non renseigne"}</strong>
              </div>
              {profile.adminNotes && (
                <div style={{ fontSize: 13, color: COLORS.ink, fontStyle: "italic", marginTop: 8, padding: 10, background: "#fff", borderRadius: 6 }}>
                  {profile.adminNotes}
                </div>
              )}
              {!profile.adminSituation && !profile.adminNotes && (
                <p style={{ fontSize: 13, color: COLORS.inkSoft, fontStyle: "italic" }}>Aucune note pour le moment — cliquez sur Modifier apres l entretien.</p>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Button onClick={() => downloadProfileAsPdf(profile)} variant="gold" style={{ flex: 1, justifyContent: "center" }}>
            Télécharger en PDF
          </Button>
          <Button onClick={onClose} variant="secondary" style={{ flex: 1, justifyContent: "center" }}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${COLORS.cream}` }}>
      <Icon size={16} color={COLORS.gold} />
      <span style={{ fontSize: 13, color: COLORS.inkSoft, minWidth: 130 }}>{label}</span>
      <span style={{ fontSize: 14, color: COLORS.ink, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ---------- Admin Dashboard ----------
function AdminDashboard({ profiles, matches, onValidate, onReject, onLogout, onDeleteProfile, onRenew, onAddProfile, onSaveNotes }) {
  const [tab, setTab] = useState("matches");
  const [viewProfile, setViewProfile] = useState(null);
  const [renewProfile, setRenewProfile] = useState(null);
  const [showManualAdd, setShowManualAdd] = useState(false);

  const pendingMatches = matches.filter(m => m.status === "pending");
  const validatedMatches = matches.filter(m => m.status === "validated");
  const expiredProfiles = profiles.filter(p => p.subscriptionExpiresAt && !isSubscriptionActive(p));

  const getProfile = (id) => profiles.find(p => p.id === id);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.cream }}>
      <header style={{
        background: COLORS.bordeauxDark, padding: "20px 28px", display: "flex",
        justifyContent: "space-between", alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Heart size={20} color={COLORS.gold} fill={COLORS.gold} />
          <span style={{ fontFamily: "Playfair Display, serif", fontSize: 19, color: "#fff" }}>{AGENCY_NAME} - Espace agence</span>
        </div>
        <Button variant="ghost" onClick={onLogout} style={{ color: COLORS.goldLight }}>Se déconnecter</Button>
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 20px" }}>
        {expiredProfiles.length > 0 && (
          <div style={{
            background: "#FBEAEA", border: "1px solid #E3B8B8", borderRadius: 12,
            padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 12, flexWrap: "wrap"
          }}>
            <span style={{ fontSize: 14, color: "#7A2222", fontWeight: 500 }}>
              {expiredProfiles.length === 1
                ? `${expiredProfiles[0].firstName} a un abonnement expiré et ne reçoit plus de matchs.`
                : `${expiredProfiles.length} profils ont un abonnement expiré et ne reçoivent plus de matchs.`}
            </span>
            <Button variant="secondary" onClick={() => setTab("profiles")} style={{ padding: "8px 14px", fontSize: 13, borderColor: "#A33", color: "#A33" }}>
              Voir et renouveler
            </Button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {[
            { id: "matches", label: `Matchs à valider (${pendingMatches.length})` },
            { id: "validated", label: `Mises en contact (${validatedMatches.length})` },
            { id: "profiles", label: `Tous les profils (${profiles.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              background: tab === t.id ? COLORS.bordeaux : "#fff",
              color: tab === t.id ? "#fff" : COLORS.inkSoft,
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "matches" && (
          <div>
            {pendingMatches.length === 0 && (
              <EmptyState text="Aucun match en attente. Les nouveaux matchs apparaitront ici automatiquement des qu un profil compatible est detecte." />
            )}
            {pendingMatches.sort((a, b) => b.score - a.score).map(m => {
              const a = getProfile(m.aId), b = getProfile(m.bId);
              if (!a || !b) return null;
              return (
                <div key={m.id} style={{
                  background: "#fff", borderRadius: 12, padding: 20, marginBottom: 14,
                  display: "flex", alignItems: "center", gap: 18, border: `1px solid ${COLORS.creamDark}`
                }}>
                  <ScoreRing score={m.score} />
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14 }}>
                    <ProfileMini profile={a} onClick={() => setViewProfile(a)} />
                    <Heart size={16} color={COLORS.goldLight} fill={COLORS.goldLight} />
                    <ProfileMini profile={b} onClick={() => setViewProfile(b)} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="secondary" onClick={() => onReject(m.id)} style={{ padding: "9px 14px" }}>
                      <X size={15} />
                    </Button>
                    <Button onClick={() => onValidate(m.id)} style={{ padding: "9px 16px" }}>
                      <Check size={15} /> Mettre en contact
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "validated" && (
          <div>
            {validatedMatches.length === 0 && <EmptyState text="Aucune mise en contact effectuée pour le moment." />}
            {validatedMatches.map(m => {
              const a = getProfile(m.aId), b = getProfile(m.bId);
              if (!a || !b) return null;
              return (
                <div key={m.id} style={{
                  background: "#fff", borderRadius: 12, padding: 20, marginBottom: 14,
                  display: "flex", alignItems: "center", gap: 18, border: `1px solid ${COLORS.creamDark}`
                }}>
                  <ScoreRing score={m.score} />
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14 }}>
                    <ProfileMini profile={a} onClick={() => setViewProfile(a)} />
                    <Check size={16} color="#3D7A5C" />
                    <ProfileMini profile={b} onClick={() => setViewProfile(b)} />
                  </div>
                  <span style={{ fontSize: 12, color: COLORS.inkSoft }}>
                    {new Date(m.validatedAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {tab === "profiles" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <Button onClick={() => setShowManualAdd(true)} variant="secondary">
                <Plus size={16} /> Ajouter un profil manuellement
              </Button>
            </div>
            {profiles.length === 0 && <EmptyState text="Aucun profil enregistré. Partagez le lien d inscription a vos clients." />}
            {profiles.map(p => {
              const active = isSubscriptionActive(p);
              const days = daysRemaining(p);
              return (
                <div key={p.id} style={{
                  background: "#fff", borderRadius: 12, padding: 16, marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 14, border: `1px solid ${COLORS.creamDark}`
                }}>
                  <Avatar photo={p.photo} name={p.firstName} size={44} />
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setViewProfile(p)}>
                    <span style={{ fontWeight: 600, color: COLORS.ink }}>{p.firstName}, {p.age} ans</span>
                    <span style={{ color: COLORS.inkSoft, fontSize: 13, marginLeft: 10 }}>{p.city}</span>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 20,
                    background: active ? "#E8F3EC" : "#FBEAEA",
                    color: active ? "#3D7A5C" : "#A33",
                  }}>
                    {active ? `Actif · ${days} j restants` : "Abonnement expiré"}
                  </span>
                  {!active && (
                    <Button variant="secondary" onClick={() => setRenewProfile(p)} style={{ fontSize: 13, padding: "8px 12px" }}>
                      Renouveler
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => onDeleteProfile(p.id)} style={{ color: "#A33", fontSize: 13 }}>
                    Retirer
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ProfileCard profile={viewProfile} onClose={() => setViewProfile(null)} onSaveNotes={onSaveNotes} />
      <RenewModal
        profile={renewProfile}
        onClose={() => setRenewProfile(null)}
        onConfirm={(planId) => { onRenew(renewProfile.id, planId); setRenewProfile(null); }}
      />
      {showManualAdd && (
        <div style={{
          position: "fixed", inset: 0, background: COLORS.cream, zIndex: 200,
          overflowY: "auto", padding: "40px 0"
        }}>
          <div style={{ maxWidth: 560, margin: "0 auto 20px", padding: "0 20px" }}>
            <Button variant="ghost" onClick={() => setShowManualAdd(false)}>
              <ArrowLeft size={16} /> Retour au tableau de bord
            </Button>
          </div>
          <RegistrationForm
            adminMode
            onCancel={() => setShowManualAdd(false)}
            onSubmit={(profile) => { onAddProfile(profile); setShowManualAdd(false); }}
          />
        </div>
      )}
    </div>
  );
}

function RenewModal({ profile, onClose, onConfirm }) {
  if (!profile) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(42,36,34,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20
    }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 380, width: "100%", padding: 28 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: "Playfair Display, serif", fontSize: 20, color: COLORS.bordeauxDark, marginTop: 0 }}>
          Renouveler - {profile.firstName}
        </h3>
        <p style={{ color: COLORS.inkSoft, fontSize: 14, marginBottom: 18 }}>Choisissez la nouvelle formule.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SUBSCRIPTION_PLANS.map(plan => (
            <button
              key={plan.id}
              onClick={() => onConfirm(plan.id)}
              style={{
                padding: "14px", borderRadius: 10,
                border: `2px solid ${plan.vip ? COLORS.gold : COLORS.creamDark}`,
                background: plan.vip ? COLORS.goldLight + "33" : COLORS.cream,
                cursor: "pointer", textAlign: "left",
                gridColumn: plan.vip ? "1 / -1" : "auto",
              }}
            >
              <div style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>
                {plan.vip ? "VIP · " : plan.label + " · "}{plan.months} mois
              </div>
              <div style={{ fontFamily: "Playfair Display, serif", fontSize: 18, color: COLORS.bordeauxDark }}>{plan.price} €</div>
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={onClose} style={{ marginTop: 16, width: "100%", justifyContent: "center" }}>Annuler</Button>
      </div>
    </div>
  );
}

function ProfileMini({ profile, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
      <Avatar photo={profile.photo} name={profile.firstName} size={40} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{profile.firstName}, {profile.age}</div>
        <div style={{ fontSize: 12, color: COLORS.inkSoft }}>{profile.city}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{
      textAlign: "center", padding: "48px 20px", color: COLORS.inkSoft, fontSize: 14.5,
      background: "#fff", borderRadius: 12, border: `1px dashed ${COLORS.creamDark}`
    }}>{text}</div>
  );
}

// ---------- Match-confirmed view for clients (mutual unlock) ----------
function MatchedView({ profile, partner, onBack }) {
  return (
    <div style={{ maxWidth: 460, margin: "40px auto", padding: "0 20px", textAlign: "center" }}>
      <Sparkles size={32} color={COLORS.gold} style={{ marginBottom: 12 }} />
      <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 26, color: COLORS.bordeauxDark }}>
        Une mise en contact a été validée
      </h2>
      <p style={{ color: COLORS.inkSoft, marginBottom: 24 }}>L'agence a validé ce profil pour vous. Vous pouvez maintenant le découvrir.</p>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: `1px solid ${COLORS.creamDark}` }}>
        <Avatar photo={partner.photo} name={partner.firstName} size={88} />
        <h3 style={{ fontFamily: "Playfair Display, serif", fontSize: 22, margin: "16px 0 4px" }}>{partner.firstName}, {partner.age} ans</h3>
        <p style={{ color: COLORS.inkSoft, fontSize: 14 }}>{partner.city}</p>
        {partner.about && <p style={{ fontStyle: "italic", marginTop: 14, color: COLORS.ink }}>"{partner.about}"</p>}
      </div>
      <Button onClick={onBack} variant="secondary" style={{ marginTop: 24 }}>Retour</Button>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [view, setView] = useState("home");
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState(false);

  const ADMIN_PASSWORD = "Coucou2002#1";

  useEffect(() => {
    (async () => {
      const [p, m] = await Promise.all([loadProfiles(), loadMatches()]);
      setProfiles(p);
      setMatches(m);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    const existingPairs = new Set(matches.map(m => [m.aId, m.bId].sort().join("|")));
    const newMatches = [];
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const a = profiles[i], b = profiles[j];
        const key = [a.id, b.id].sort().join("|");
        if (existingPairs.has(key)) continue;
        const score = computeScore(a, b);
        if (score >= 35) {
          newMatches.push({ id: uid(), aId: a.id, bId: b.id, score, status: "pending", createdAt: Date.now() });
        }
      }
    }
    if (newMatches.length > 0) {
      const updated = [...matches, ...newMatches];
      setMatches(updated);
      saveMatches(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, loading]);

  const handleRegister = async (profile) => {
    const ok = await saveOneProfile(profile);
    if (ok) {
      setProfiles(p => [...p, profile]);
      setView("confirmation");
    } else {
      setView("registration-error");
    }
  };

  const handleAddProfileManually = async (profile) => {
    const updated = [...profiles, profile];
    setProfiles(updated);
    await saveProfiles(updated);
  };

  const handleSaveNotes = async (id, notes) => {
    const updated = profiles.map(p => p.id === id ? { ...p, ...notes } : p);
    setProfiles(updated);
    await saveProfiles(updated);
  };

  const handleValidate = async (matchId) => {
    const updated = matches.map(m => m.id === matchId ? { ...m, status: "validated", validatedAt: Date.now() } : m);
    setMatches(updated);
    await saveMatches(updated);
  };
  const handleReject = async (matchId) => {
    const updated = matches.map(m => m.id === matchId ? { ...m, status: "rejected" } : m);
    setMatches(updated);
    await saveMatches(updated);
  };
  const handleDeleteProfile = async (id) => {
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    await saveProfiles(updated);
    await deleteProfileDoc(id);
  };

  const handleRenew = async (id, planId) => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    const now = Date.now();
    const updated = profiles.map(p => p.id === id ? {
      ...p,
      subscriptionStartedAt: now,
      subscriptionExpiresAt: addMonths(now, plan.months),
      subscriptionPrice: plan?.price,
      subscriptionPlanLabel: plan?.vip ? `VIP ${plan.months} mois` : `${plan.label} ${plan.months} mois`,
      isVip: !!plan?.vip,
    } : p);
    setProfiles(updated);
    await saveProfiles(updated);
  };

  const handleAdminLogin = (pwd) => {
    if (pwd === ADMIN_PASSWORD) { setAdminAuthed(true); setView("admin"); setLoginError(false); }
    else { setLoginError(true); }
  };

  const fontImports = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      * { font-family: 'Inter', sans-serif; }
      body { margin: 0; }
    `}</style>
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.cream }}>
        {fontImports}
        <Heart size={28} color={COLORS.bordeaux} />
      </div>
    );
  }

  if (view === "admin" && adminAuthed) {
    return (
      <div>
        {fontImports}
        <AdminDashboard
          profiles={profiles} matches={matches}
          onValidate={handleValidate} onReject={handleReject}
          onDeleteProfile={handleDeleteProfile}
          onRenew={handleRenew}
          onAddProfile={handleAddProfileManually}
          onSaveNotes={handleSaveNotes}
          onLogout={() => { setAdminAuthed(false); setView("home"); }}
        />
      </div>
    );
  }

  if (view === "admin-login") {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream }}>
        {fontImports}
        <AdminLogin onLogin={handleAdminLogin} />
        {loginError && (
          <p style={{ textAlign: "center", color: "#A33", fontSize: 13 }}>Mot de passe incorrect, réessayez.</p>
        )}
        <div style={{ textAlign: "center" }}>
          <Button variant="ghost" onClick={() => setView("home")}>Retour à l'accueil</Button>
        </div>
      </div>
    );
  }

  if (view === "register") {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, padding: "48px 0" }}>
        {fontImports}
        <RegistrationForm onSubmit={handleRegister} onCancel={() => setView("home")} />
      </div>
    );
  }

  if (view === "confirmation") {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {fontImports}
        <div style={{ textAlign: "center", maxWidth: 420, padding: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "#3D7A5C", margin: "0 auto 20px",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Check size={28} color="#fff" />
          </div>
          <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 26, color: COLORS.bordeauxDark }}>
            Votre profil a été transmis
          </h2>
          <p style={{ color: COLORS.inkSoft, marginTop: 10, lineHeight: 1.6 }}>
            L'agence va l'examiner avec discrétion. Vous serez contacté(e) personnellement si un profil correspond à vos critères. Votre photo et vos informations restent confidentielles jusqu'à validation.
          </p>
          <Button onClick={() => setView("home")} style={{ marginTop: 24 }}>Retour à l'accueil</Button>
        </div>
      </div>
    );
  }

  if (view === "registration-error") {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {fontImports}
        <div style={{ textAlign: "center", maxWidth: 420, padding: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "#A33", margin: "0 auto 20px",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <X size={28} color="#fff" />
          </div>
          <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 26, color: COLORS.bordeauxDark }}>
            Un problème technique est survenu
          </h2>
          <p style={{ color: COLORS.inkSoft, marginTop: 10, lineHeight: 1.6 }}>
            Votre profil n'a pas pu être enregistré (probablement une photo trop volumineuse). Merci de réessayer avec des photos plus légères, ou de contacter directement l'agence pour finaliser votre inscription.
          </p>
          <Button onClick={() => setView("register")} style={{ marginTop: 24 }}>Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.cream }}>
      {fontImports}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Heart size={32} color={COLORS.bordeaux} fill={COLORS.bordeaux} />
        </div>
        <div style={{
          fontFamily: "Playfair Display, serif", fontSize: 15, letterSpacing: "0.12em",
          textTransform: "uppercase", color: COLORS.gold, fontWeight: 600, marginBottom: 18
        }}>{AGENCY_NAME}</div>
        <h1 style={{
          fontFamily: "Playfair Display, serif", fontSize: 42, color: COLORS.bordeauxDark,
          margin: "0 0 16px", lineHeight: 1.15
        }}>
          Des rencontres pensées<br />avec discrétion
        </h1>
        <p style={{ fontSize: 16, color: COLORS.inkSoft, maxWidth: 460, margin: "0 auto 40px", lineHeight: 1.6 }}>
          Votre profil reste privé. Vous découvrez l'autre seulement lorsqu'une mise en
          relation a été validée personnellement par l'agence.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Button onClick={() => setView("register")} style={{ padding: "15px 32px", fontSize: 15.5 }}>
            <Plus size={17} /> Créer mon profil
          </Button>
          <Button onClick={() => setView("admin-login")} variant="secondary" style={{ padding: "15px 32px", fontSize: 15.5 }}>
            <Lock size={16} /> Espace agence
          </Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginTop: 72, textAlign: "left" }}>
          <FeatureCard icon={Lock} title="Confidentialité totale" text="Personne ne voit votre profil avant une validation manuelle." />
          <FeatureCard icon={Sparkles} title="Matching automatique" text="Les profils compatibles sont détectés selon vos critères réels." />
          <FeatureCard icon={Users} title="Validation humaine" text="Aucune mise en contact sans l accord de l agence." />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 22, border: `1px solid ${COLORS.creamDark}` }}>
      <Icon size={20} color={COLORS.gold} />
      <h4 style={{ fontFamily: "Playfair Display, serif", fontSize: 16, color: COLORS.bordeauxDark, margin: "12px 0 6px" }}>{title}</h4>
      <p style={{ fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 1.5, margin: 0 }}>{text}</p>
    </div>
  );
}
