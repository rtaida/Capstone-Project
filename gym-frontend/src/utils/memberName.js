export const buildMemberFullName = ({ first_name, last_name, middle_initial }) => {
  const firstName = String(first_name || "").trim();
  const lastName = String(last_name || "").trim();
  const middleInitial = String(middle_initial || "").trim().replace(/\.$/, "");
  return [firstName, middleInitial ? `${middleInitial}.` : "", lastName]
    .filter(Boolean)
    .join(" ");
};

export const splitMemberName = (member = {}) => {
  const firstName = String(member.first_name || "").trim();
  const lastName = String(member.last_name || "").trim();
  if (firstName && lastName) {
    return {
      first_name: firstName,
      last_name: lastName,
      middle_initial: String(member.middle_initial || "").trim().replace(/\.$/, ""),
    };
  }

  const parts = String(member.full_name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length > 2 && /^[\p{L}]\.?$/u.test(parts[1])) {
    return {
      first_name: parts[0],
      middle_initial: parts[1].replace(/\.$/, ""),
      last_name: parts.slice(2).join(" "),
    };
  }
  return {
    first_name: parts[0] || "",
    middle_initial: "",
    last_name: parts.slice(1).join(" "),
  };
};