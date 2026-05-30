import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import {
  FiActivity,
  FiAlertCircle,
  FiGrid,
  FiSearch,
  FiUsers,
  FiBriefcase,
} from "react-icons/fi";
import { api } from "../../../api/httpClient";
import { canManageWorkspace } from "../../../lib/workspacePaths";
import { buildWorkspaceSearchResults } from "../../../lib/workspaceSearch";
import { useWorkspacePaths } from "../hooks/useWorkspacePaths";

const DEBOUNCE_MS = 200;

const SECTION_ICONS = {
  dashboard: FiGrid,
  incidents: FiAlertCircle,
  status: FiActivity,
  team: FiUsers,
  company: FiBriefcase,
};

const WorkspaceSearch = () => {
  const navigate = useNavigate();
  const paths = useWorkspacePaths();
  const user = useSelector((state) => state.auth.user);
  const isPrivileged = canManageWorkspace(user?.role);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const debounceRef = useRef(null);
  const [panelRect, setPanelRect] = useState(null);

  const updatePanelPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPanelRect({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.max(rect.width, 300),
    });
  }, []);

  const loadSearchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const membersPromise = api.get("/company/members");
      const incidentsPromise = api.get("/incidents");
      const invitesPromise = isPrivileged
        ? api.get("/company/invites/pending")
        : Promise.resolve({ data: { invites: [] } });

      const [incRes, memRes, invRes] = await Promise.all([
        incidentsPromise,
        membersPromise.catch(() => ({ data: { members: [] } })),
        invitesPromise.catch(() => ({ data: { invites: [] } })),
      ]);

      setIncidents(incRes?.data?.incidents || []);
      setMembers(memRes?.data?.members || []);
      setPendingInvites(invRes?.data?.invites || []);
      setDataLoaded(true);
    } catch {
      setIncidents([]);
      setMembers([]);
      setPendingInvites([]);
    } finally {
      setIsLoading(false);
    }
  }, [isPrivileged]);

  const showPanel = isOpen && query.trim().length > 0;

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (
        containerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !query.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadSearchData();
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen, loadSearchData]);

  useEffect(() => {
    if (!showPanel) {
      setPanelRect(null);
      return;
    }
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [showPanel, updatePanelPosition]);

  const sections = useMemo(
    () =>
      buildWorkspaceSearchResults({
        query,
        incidents,
        members,
        pendingInvites,
        paths,
        includeCompany: isPrivileged,
      }),
    [query, incidents, members, pendingInvites, paths, isPrivileged],
  );

  const totalResults = useMemo(
    () => sections.reduce((sum, section) => sum + section.items.length, 0),
    [sections],
  );

  const stopScrollPropagation = (event) => {
    event.stopPropagation();
  };

  const handleChange = (event) => {
    setQuery(event.target.value);
    setIsOpen(true);
    requestAnimationFrame(updatePanelPosition);
  };

  const handleFocus = () => {
    setIsOpen(true);
    requestAnimationFrame(updatePanelPosition);
  };

  const handleSelect = (path) => {
    setIsOpen(false);
    setQuery("");
    navigate(path);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "Enter" && sections.length > 0) {
      const first = sections[0]?.items?.[0];
      if (first?.path) {
        event.preventDefault();
        handleSelect(first.path);
      }
    }
  };

  const searchPanel =
    showPanel && panelRect ? (
      <div
        ref={panelRef}
        role="listbox"
        className="fixed z-[9999] flex flex-col max-h-[min(70vh,20rem)] bg-bg border border-border rounded-xl shadow-lg overflow-hidden"
        style={{
          top: panelRect.top,
          left: panelRect.left,
          width: panelRect.width,
        }}>
        <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center justify-between gap-2 bg-bg">
          <span className="text-[10px] font-semibold text-text-muted">
            Results
          </span>
          {dataLoaded && !isLoading && (
            <span className="text-[10px] text-text-muted tabular-nums">
              {totalResults}
            </span>
          )}
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain py-1"
          onWheel={stopScrollPropagation}
          onTouchMove={stopScrollPropagation}>
          {isLoading && !dataLoaded && (
            <p className="px-3 py-4 text-xs text-text-muted font-medium text-center">
              Searching…
            </p>
          )}

          {dataLoaded && !isLoading && sections.length === 0 && (
            <p className="px-3 py-4 text-xs text-text-muted font-medium text-center">
              No results for &ldquo;{query.trim()}&rdquo;
            </p>
          )}

          {sections.map((section, sectionIndex) => {
            const Icon = SECTION_ICONS[section.id] || FiSearch;
            return (
              <section
                key={section.id}
                className={
                  sectionIndex > 0
                    ? "mt-2 pt-2 border-t border-border/60"
                    : "mt-1"
                }
                aria-label={section.label}>
                <div className="flex items-center gap-1.5 px-3 py-1 mb-0.5">
                  <Icon
                    size={11}
                    className="shrink-0 text-text-muted/80"
                    aria-hidden
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    {section.label}
                  </span>
                  <span className="text-[10px] text-text-muted/60 tabular-nums">
                    ({section.items.length})
                  </span>
                </div>

                <ul className={`ml-3 border-l ${section.accentClass} pl-0.5`}>
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item.path)}
                        className="w-full text-left rounded-md px-2.5 py-2 hover:bg-primary/10 transition-colors group">
                        <span className="block text-[13px] font-medium text-text truncate group-hover:text-primary">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="block text-[10px] text-text-muted truncate mt-0.5">
                            {item.subtitle}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <div ref={containerRef} className="relative w-55 sm:w-64">
      <FiSearch
        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10 pointer-events-none"
        size={14}
      />
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="Search workspace..."
        className="w-full bg-input border border-border rounded-full py-2 pl-9 pr-4 text-[11px] text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
        autoComplete="off"
        aria-expanded={showPanel}
        aria-haspopup="listbox"
      />

      {searchPanel && createPortal(searchPanel, document.body)}
    </div>
  );
};

export default WorkspaceSearch;
