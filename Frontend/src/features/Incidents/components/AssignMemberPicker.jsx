import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiUserPlus } from "react-icons/fi";
import { getTeamTagLabel } from "../../../lib/teamTags";

const formatRoleLabel = (role = "") => {
  if (!role) return "";
  if (role === "CEO") return "CEO";
  return role.charAt(0) + role.slice(1).toLowerCase();
};

const MemberOption = ({ member, isSelected, onSelect }) => {
  const tagLabel = member.teamTag ? getTeamTagLabel(member.teamTag) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(member._id)}
      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
        isSelected
          ? "bg-primary/10"
          : "hover:bg-bg-muted"
      }`}>
      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
        {(member.name || member.email || "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold text-text truncate">
            {member.name || "Unnamed"}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/15 text-primary border border-primary/20">
            {formatRoleLabel(member.role)}
          </span>
          {tagLabel && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-bg-muted text-text-muted border border-border">
              {tagLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted font-medium truncate mt-0.5">
          {member.email}
        </p>
      </div>
    </button>
  );
};

const AssignMemberPicker = ({
  members = [],
  assignedIds = [],
  value = "",
  onChange,
  disabled = false,
  placeholder = "Choose a team member to assign",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const assignedSet = useMemo(
    () => new Set(assignedIds.map((id) => String(id))),
    [assignedIds],
  );

  const availableMembers = useMemo(
    () =>
      members.filter((member) => member?._id && !assignedSet.has(String(member._id))),
    [members, assignedSet],
  );

  const selectedMember = useMemo(
    () => members.find((m) => String(m._id) === String(value)),
    [members, value],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (value && assignedSet.has(String(value))) {
      onChange?.("");
    }
  }, [value, assignedSet, onChange]);

  const handleSelect = (memberId) => {
    onChange?.(memberId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center gap-3 bg-input border border-border rounded-lg px-3 py-2.5 text-left transition-colors shadow-sm ${
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:border-primary/40 focus:outline-none focus:border-primary cursor-pointer"
        } ${isOpen ? "border-primary ring-1 ring-primary/20" : ""}`}>
        <FiUserPlus className="text-text-muted shrink-0" size={18} />
        <div className="flex-1 min-w-0">
          {selectedMember ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-bold text-text truncate">
                  {selectedMember.name}
                </span>
                {selectedMember.teamTag && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-bg-muted text-text-muted border border-border">
                    {getTeamTagLabel(selectedMember.teamTag)}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted truncate">
                {selectedMember.email}
              </p>
            </>
          ) : (
            <span className="text-sm text-text-muted font-medium">
              {placeholder}
            </span>
          )}
        </div>
        <FiChevronDown
          className={`text-text-muted shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          size={18}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 bg-bg-surface border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto overscroll-y-contain">
          {availableMembers.length > 0 ? (
            availableMembers.map((member) => (
              <MemberOption
                key={member._id}
                member={member}
                isSelected={String(member._id) === String(value)}
                onSelect={handleSelect}
              />
            ))
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-bold text-text">
                All team members are assigned
              </p>
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                Every available developer and member is already on this
                incident.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssignMemberPicker;
