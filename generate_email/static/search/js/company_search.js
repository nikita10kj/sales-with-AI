document.addEventListener("DOMContentLoaded", function () {

    // ══ Helpers ══
    function esc(v) {
        if (v === null || v === undefined) return "";
        return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function getCookie(name) {
        var val = null;
        if (document.cookie) {
            document.cookie.split(";").forEach(function(c) {
                c = c.trim();
                if (c.startsWith(name + "=")) val = decodeURIComponent(c.slice(name.length + 1));
            });
        }
        return val;
    }

    // ══ Toast ══
    var customMessage     = document.getElementById("customMessage");
    var customMessageText = document.getElementById("customMessageText");
    var closeCustomMessage = document.getElementById("closeCustomMessage");
    var msgTimeout;

    function showMessage(msg, type) {
        if (!customMessage || !customMessageText) return;
        customMessageText.textContent = msg;
        customMessage.classList.remove("custom-message-success", "custom-message-error");
        customMessage.classList.add(type === "error" ? "custom-message-error" : "custom-message-success");
        customMessage.style.display = "block";
        clearTimeout(msgTimeout);
        msgTimeout = setTimeout(function() { customMessage.style.display = "none"; }, 4000);
    }

    if (closeCustomMessage) {
        closeCustomMessage.addEventListener("click", function() {
            customMessage.style.display = "none";
            clearTimeout(msgTimeout);
        });
    }

    // ══ Filter toggles ══
    document.querySelectorAll(".filter-toggle").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var p = btn.closest(".filter-item");
            if (p) p.classList.toggle("active");
        });
    });

    // ══ Tag inputs ══
    var tagInputInstances = [];

    function setupTagInput(cfg) {
        var input   = document.getElementById(cfg.inputId);
        var addBtn  = document.getElementById(cfg.addBtnId);
        var cont    = document.getElementById(cfg.tagsContainerId);
        var hidden  = document.getElementById(cfg.hiddenInputId);
        if (!input || !addBtn || !cont || !hidden) return;

        var tags = hidden.value.trim()
            ? hidden.value.split(",").map(function(t){ return t.trim(); }).filter(Boolean)
            : [];

        function sync() { hidden.value = tags.join(","); }

        function render() {
            cont.innerHTML = "";
            tags.forEach(function(t, i) {
                var tag = document.createElement("div");
                tag.className = "tag";
                tag.innerHTML = '<span class="tag-text">' + esc(t) + '</span>'
                    + '<span class="tag-remove" data-index="' + i + '">&times;</span>';
                cont.appendChild(tag);
            });
            cont.querySelectorAll(".tag-remove").forEach(function(btn) {
                btn.addEventListener("click", function() {
                    tags.splice(parseInt(btn.getAttribute("data-index"), 10), 1);
                    sync(); render();
                });
            });
        }

        function addTag(val) {
            var v = (val !== undefined ? val : input.value).trim();
            if (!v || tags.some(function(t){ return t.toLowerCase() === v.toLowerCase(); })) { input.value = ""; return; }
            tags.push(v); sync(); render(); input.value = ""; input.focus();
        }

        addBtn.addEventListener("click", function() { addTag(); });
        input.addEventListener("keydown", function(e) {
            if (e.key === "Enter") { e.preventDefault(); addTag(); }
            if (e.key === ",") {
                e.preventDefault();
                input.value.split(",").map(function(v){ return v.trim(); }).filter(Boolean).forEach(addTag);
                input.focus();
            }
            if (e.key === "Backspace" && !input.value.trim() && tags.length) { tags.pop(); sync(); render(); }
        });

        render(); sync();
        tagInputInstances.push({ finalizePendingInput: function() { if (input.value.trim()) addTag(); } });
    }

    [
        { inputId:"companyInput",             addBtnId:"addCompanyTag",             tagsContainerId:"companyTags",             hiddenInputId:"companyHidden" },
        { inputId:"companyLocationInput",     addBtnId:"addCompanyLocationTag",     tagsContainerId:"companyLocationTags",     hiddenInputId:"companyLocationHidden" },
        { inputId:"companySpecialitesInput",  addBtnId:"addCompanySpecialitesTag",  tagsContainerId:"companySpecialitesTags",  hiddenInputId:"companySpecialitesHidden" },
        { inputId:"employeeCountInput",       addBtnId:"addEmployeeCountTag",       tagsContainerId:"employeeCountTags",       hiddenInputId:"employeeCountHidden" },
        { inputId:"companyTechnologiesInput", addBtnId:"addCompanyTechnologiesTag", tagsContainerId:"companyTechnologiesTags", hiddenInputId:"companyTechnologiesHidden" },
        { inputId:"jobPostsInput",            addBtnId:"addJobPostsTag",            tagsContainerId:"jobPostsTags",            hiddenInputId:"jobPostsHidden" }
    ].forEach(setupTagInput);

    // ══ Shared multi-select dropdown factory ══
    function setupMultiSelect(cfg) {
        var dropdown    = document.getElementById(cfg.dropdownId);
        var trigger     = document.getElementById(cfg.triggerId);
        var hidden      = document.getElementById(cfg.hiddenId);
        var placeholder = document.getElementById(cfg.placeholderId);
        var optionsEl   = cfg.optionsId ? document.getElementById(cfg.optionsId) : null;
        if (!dropdown || !trigger || !hidden) return;

        function update() {
            var checked = [];
            dropdown.querySelectorAll("." + cfg.cbClass + ":checked").forEach(function(cb) { checked.push(cb.value); });
            hidden.value = checked.join(",");
            if (placeholder) {
                placeholder.textContent = checked.length ? checked.join(", ") : cfg.emptyText;
                placeholder.style.color = checked.length ? "#1a2038" : "#aab0c4";
            }
        }

        if (hidden.value) {
            var saved = hidden.value.split(",").map(function(v){ return v.trim(); }).filter(Boolean);
            dropdown.querySelectorAll("." + cfg.cbClass).forEach(function(cb) {
                if (saved.indexOf(cb.value) !== -1) cb.checked = true;
            });
            update();
        }

        trigger.addEventListener("click", function(e) {
            e.stopPropagation();
            if (optionsEl) {
                var isOpen = optionsEl.style.display !== "none";
                optionsEl.style.display = isOpen ? "none" : "block";
                dropdown.classList.toggle("open", !isOpen);
            } else {
                dropdown.classList.toggle("open");
            }
        });

        document.addEventListener("click", function(e) {
            if (!dropdown.contains(e.target)) {
                if (optionsEl) { optionsEl.style.display = "none"; }
                dropdown.classList.remove("open");
            }
        });

        dropdown.querySelectorAll("." + cfg.cbClass).forEach(function(cb) {
            cb.addEventListener("change", update);
        });
    }

    setupMultiSelect({ dropdownId:"employeeCountDropdown", triggerId:"employeeCountTrigger", hiddenId:"employeeCountHidden", placeholderId:"employeeCountPlaceholder", cbClass:"employee-count-cb", emptyText:"Select employee count" });
    setupMultiSelect({ dropdownId:"companyMarketDropdown", triggerId:"companyMarketTrigger", hiddenId:"companyMarketHidden", placeholderId:"companyMarketPlaceholder", optionsId:"companyMarketOptions", cbClass:"company-market-cb", emptyText:"Select market type" });

    // ══ Industry Autocomplete ══
    (function() {
        var dataEl = document.getElementById("industryChoicesData");
        if (!dataEl) return;
        var INDUSTRIES = JSON.parse(dataEl.textContent);

        var input      = document.getElementById("industryInput");
        var suggestions = document.getElementById("industrySuggestions");
        var tagsCont   = document.getElementById("industryTagsSelected");
        var hidden     = document.getElementById("industryHidden");
        if (!input || !suggestions || !tagsCont || !hidden) return;

        var searchBtn = document.querySelector('#companySearchForm button[type="submit"]');
        var selected  = hidden.value ? hidden.value.split(",").map(function(v){ return v.trim(); }).filter(Boolean) : [];

        function enableBtn() {
            if (searchBtn) { searchBtn.disabled = false; searchBtn.title = ""; searchBtn.style.opacity = ""; searchBtn.style.cursor = ""; }
        }
        function disableBtn() {
            if (searchBtn) { searchBtn.disabled = true; searchBtn.title = "Please select an industry from the suggestions list"; searchBtn.style.opacity = "0.5"; searchBtn.style.cursor = "not-allowed"; }
        }

        function renderTags() {
            tagsCont.innerHTML = "";
            selected.forEach(function(val, i) {
                var tag = document.createElement("div");
                tag.className = "tag";
                tag.innerHTML = '<span class="tag-text">' + esc(val) + '</span><span class="tag-remove" data-index="' + i + '">&times;</span>';
                tagsCont.appendChild(tag);
            });
            tagsCont.querySelectorAll(".tag-remove").forEach(function(btn) {
                btn.addEventListener("click", function() {
                    selected.splice(parseInt(btn.dataset.index), 1);
                    hidden.value = selected.join(",");
                    renderTags();
                });
            });
        }

        function showSuggestions(q) {
            q = q.toLowerCase().trim();
            if (!q) { suggestions.style.display = "none"; return; }
            var matches = INDUSTRIES.filter(function(ind) {
                return ind.toLowerCase().indexOf(q) !== -1 && selected.indexOf(ind) === -1;
            }).slice(0, 10);
            if (!matches.length) { suggestions.style.display = "none"; return; }
            suggestions.innerHTML = matches.map(function(ind) {
                var hi = ind.replace(new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + ")", "gi"), "<strong>$1</strong>");
                return '<li data-value="' + esc(ind) + '" style="padding:8px 14px;font-size:13px;color:#1a2038;cursor:pointer;" onmouseover="this.style.background=\'#f4f5fb\'" onmouseout="this.style.background=\'\'">' + hi + '</li>';
            }).join("");
            suggestions.querySelectorAll("li").forEach(function(li) {
                li.addEventListener("click", function() {
                    var val = li.dataset.value;
                    if (val && selected.indexOf(val) === -1) { selected.push(val); hidden.value = selected.join(","); renderTags(); }
                    input.value = ""; suggestions.style.display = "none"; input.focus(); enableBtn();
                });
            });
            suggestions.style.display = "block";
        }

        input.addEventListener("input", function() { showSuggestions(input.value); input.value.trim() ? disableBtn() : enableBtn(); });
        input.addEventListener("keydown", function(e) {
            if (e.key === "Escape") { suggestions.style.display = "none"; input.value = ""; enableBtn(); }
        });
        document.addEventListener("click", function(e) {
            if (!input.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = "none";
                if (input.value.trim()) { input.value = ""; enableBtn(); }
            }
        });

        renderTags(); hidden.value = selected.join(",");
    })();

    // ══ Search loader ══
    function showSearchLoader() { var el = document.getElementById("searchLoaderOverlay"); if (el) el.style.display = "flex"; }
    function hideSearchLoader() { var el = document.getElementById("searchLoaderOverlay"); if (el) el.style.display = "none"; }

    // ══ Build company results HTML ══
    function buildCompanyResultsHTML(companies, pagination) {
        if (!companies || !companies.length) {
            return '<div class="empty-box"><i class="fas fa-building"></i><p>No results found. Try different filters.</p></div>';
        }

        var cur      = (pagination && pagination.current) || 1;
        var total    = (pagination && pagination.total)   || 0;
        var pageSize = companies.length;
        var startIdx = (cur - 1) * pageSize + 1;
        var endIdx   = Math.min(startIdx + pageSize - 1, total);

        var html = '<div class="results-card">'
            + '<div class="results-meta"><div class="results-meta-left">'
            + '<input type="checkbox" id="selectAllRows"> <i class="fas fa-chevron-down" style="font-size:11px;color:#aab0c4;cursor:pointer;"></i>'
            + ' <span id="selectedCountText">0 selected of ' + companies.length + ' results</span>'
            + '</div><div class="results-meta-right">'
            + '<span style="font-size:13px;color:#6a7388;margin-right:12px;">' + startIdx + '\u2013' + endIdx + ' of ' + total + '</span>'
            + '<button type="button" id="saveToListBtn" class="save-list-btn" style="display:none;"><i class="fas fa-plus"></i> Save to List</button>'
            + '</div></div>'
            + '<div class="table-wrap"><table class="results-table"><thead><tr>'
            + '<th class="col-chk"></th><th>Company</th><th>Description</th>'
            + '<th>HQ Location</th><th>Industry</th><th>Company Size</th><th>Actions</th>'
            + '</tr></thead><tbody>';

        companies.forEach(function(c, i) {
            var idx = i + 1;
            html += '<tr id="company-card-' + idx + '">'
                + '<td class="col-chk"><input type="checkbox" class="row-checkbox"'
                + ' data-name="' + esc(c.name) + '" data-linkedin_url="' + esc(c.linkedin_url || "") + '"'
                + ' data-website="' + esc(c.website || "") + '" data-industry="' + esc(c.industry || "") + '"'
                + ' data-description="' + esc(c.description || "") + '" data-company_size="' + esc(c.company_size || "") + '"'
                + ' data-headquarter="' + esc(c.headquarter || "") + '"></td>';

            // Company cell
            html += '<td class="drawer-trigger"><div class="profile-cell">'
                + (c.linkedin_url ? '<a href="' + esc(c.linkedin_url) + '" target="_blank" class="avatar-link" title="View on LinkedIn">' : '')
                + '<div class="' + (c.logo_url ? 'company-avatar' : 'company-avatar fallback-avatar') + '">'
                + (c.logo_url ? '<img src="' + esc(c.logo_url) + '" alt="Company Logo" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'fallback-avatar\');">' : '')
                + '<div class="avatar-placeholder"><span class="shape shape1"></span><span class="shape shape2"></span></div></div>'
                + (c.linkedin_url ? '</a>' : '')
                + '<div class="profile-info"><span class="profile-name drawer-trigger" data-tooltip="' + esc(c.name) + '">' + esc(c.name || "\u2014") + '</span>'
                + (c.linkedin_url ? '<a href="' + esc(c.linkedin_url) + '" target="_blank" class="li-badge" title="LinkedIn">in</a>' : '')
                + '</div></div></td>';

            html += '<td class="cell-truncate cell-desc drawer-trigger">' + esc(c.description || "\u2014") + '</td>';

            // Location, Industry, Size cells
            [
                { val: c.headquarter,  icon: "fas fa-map-marker-alt" },
                { val: c.industry,     icon: "fas fa-industry" },
                { val: c.company_size, icon: "fas fa-users", suffix: c.company_size ? " employees" : "" }
            ].forEach(function(d) {
                html += '<td class="cell-truncate' + (d.icon === "fas fa-users" ? '' : ' drawer-trigger') + '"'
                    + (d.val ? ' data-tooltip="' + esc(d.val) + (d.suffix || '') + '"' : '') + '>'
                    + (d.val ? '<span class="cell-icon"><i class="' + d.icon + '"></i></span>' + esc(d.val) : '\u2014') + '</td>';
            });

            // Actions
            html += '<td><div class="action-icons">'
                + (c.linkedin_url ? '<a href="' + esc(c.linkedin_url) + '" target="_blank" title="View LinkedIn"><i class="fab fa-linkedin-in"></i></a>' : '<button type="button" title="LinkedIn N/A" disabled><i class="fab fa-linkedin-in"></i></button>')
                + (c.website ? '<a href="' + esc(c.website) + '" target="_blank" title="Visit Website"><i class="fas fa-external-link-alt"></i></a>' : '<button type="button" title="Website N/A" disabled><i class="fas fa-external-link-alt"></i></button>')
                + '<button type="button" title="Save to List" class="single-save-btn"><i class="far fa-bookmark"></i></button>'
                + '</div></td></tr>';
        });

        html += '</tbody></table></div>';

        // Pagination
        var totalPages = (pagination && (pagination.total_pages || pagination.last_page)) || 1;
        var hasNext    = pagination && pagination.has_next;

        function buildPageRange(cur, tot, win) {
            var pages = [], left = Math.max(1, cur - win), right = Math.min(tot, cur + win);
            if (left > 1) { pages.push(1); if (left > 2) pages.push(-1); }
            for (var p = left; p <= right; p++) pages.push(p);
            if (right < tot) { if (right < tot - 1) pages.push(-1); pages.push(tot); }
            return pages;
        }

        var pageRange = (pagination && pagination.page_range) || buildPageRange(cur, totalPages, 2);

        html += '<div class="results-footer"><div class="pagination-wrap">'
            + '<button class="page-btn page-btn-text" type="button"' + (cur <= 1 ? ' disabled' : ' onclick="changeCompanyPage(1)"') + '>&lt;&lt; First</button>'
            + '<button class="page-btn page-btn-text" type="button"' + (cur <= 1 ? ' disabled' : ' onclick="changeCompanyPage(' + (cur - 1) + ')"') + '>&lt; Prev</button>';

        pageRange.forEach(function(p) {
            if (p === -1) html += '<span class="page-ellipsis">\u2026</span>';
            else if (p === cur) html += '<button class="page-btn page-num active" type="button">' + p + '</button>';
            else html += '<button class="page-btn page-num" type="button" onclick="changeCompanyPage(' + p + ')">' + p + '</button>';
        });

        html += '<button class="page-btn page-btn-text" type="button"' + (hasNext ? ' onclick="changeCompanyPage(' + (cur + 1) + ')"' : ' disabled') + '>Next &gt;</button>'
            + '<button class="page-btn page-btn-text" type="button"' + (cur >= totalPages ? ' disabled' : ' onclick="changeCompanyPage(' + totalPages + ')"') + '>Last &gt;&gt;</button>'
            + '</div></div></div>';

        return html;
    }

    // ══ Build company profile drawer templates ══
    function buildCompanyProfilesHTML(companies) {
        var html = '';
        companies.forEach(function(c, i) {
            var idx     = i + 1;
            var initial = (c.name || "C").charAt(0);

            html += '<div id="company-profile-' + idx + '" class="company-profile-tpl" style="display:none;" aria-hidden="true">';

            // Hero
            html += '<div style="background:#fff;margin:0 0 16px 0;border-bottom:1px solid #e8ebf2;">'
                + '<div class="drawer-hero" style="border-bottom:none;"><div class="drawer-hero-top">'
                + '<div class="drawer-avatar" style="border-radius:10px;border:1px solid #e0e4f0;background:#fff;padding:4px;">';
            if (c.logo_url) {
                html += '<img src="' + esc(c.logo_url) + '" alt="' + esc(c.name) + '" style="border-radius:6px;object-fit:contain;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                    + '<span class="drawer-avatar-initials" style="display:none;color:#1a2038;">' + esc(initial) + '</span>';
            } else {
                html += '<span class="drawer-avatar-initials" style="color:#1a2038;">' + esc(initial) + '</span>';
            }
            html += '</div><div class="drawer-name-block"><div class="drawer-name">';
            if (c.linkedin_url) html += '<a href="' + esc(c.linkedin_url) + '" target="_blank" style="color:inherit;text-decoration:none;">' + esc(c.name) + '</a> <a href="' + esc(c.linkedin_url) + '" target="_blank" class="li-badge" title="LinkedIn" style="text-decoration:none;">in</a>';
            else html += esc(c.name);
            if (c.website) html += ' <a href="' + esc(c.website) + '" target="_blank" style="margin-left:6px;color:#6a7388;font-size:14px;"><i class="fas fa-link"></i></a>';
            html += '</div></div></div>';

            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                + '<div class="drawer-meta-item"><i class="fas fa-map-marker-alt"></i><span>' + esc(c.location_country || c.headquarter || "\u2014") + '</span></div>'
                + (c.linkedin_url ? '<a href="' + esc(c.linkedin_url) + '" target="_blank" style="color:#2f6df0;font-size:12.5px;font-weight:600;text-decoration:none;">View Company Profile</a>' : '')
                + '</div>';

            if (c.description) {
                html += '<div style="background:#f4f5fb;border-radius:10px;border:1px solid #e8ebf2;padding:12px 14px;">'
                    + '<div style="font-size:13px;color:#4c556f;line-height:1.6;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;line-clamp:3;-webkit-box-orient:vertical;" class="drawer-desc-content">' + esc(c.description) + '</div>'
                    + '<button type="button" class="drawer-desc-toggle" style="border:none;background:none;color:#6a7388;font-size:13px;font-weight:500;cursor:pointer;padding:0;margin-top:8px;display:inline-flex;align-items:center;gap:6px;font-family:\'Inter\',sans-serif;"><i class="fas fa-chevron-down" style="font-size:10px;transition:transform 0.2s;"></i> <span class="toggle-text">Read More</span></button>'
                    + '</div>';
            }
            html += '</div></div>';

            // Basic Details
            html += '<div style="background:#fff;border-top:1px solid #e8ebf2;border-bottom:1px solid #e8ebf2;margin-bottom:16px;">'
                + '<div class="drawer-section" style="border-bottom:none;">'
                + '<div style="font-size:16px;font-weight:700;color:#1a2038;margin-bottom:16px;">Basic Details</div>'
                + '<div style="display:grid;grid-template-columns:140px 1fr;gap:12px;font-size:13px;color:#4c556f;">';

            var details = [
                { icon:"far fa-user",        label:"Company Size", value:c.company_size },
                { icon:"fas fa-map-marker-alt", label:"HQ Location", value:c.headquarter },
                { icon:"far fa-building",    label:"Industry",     value:c.industry }
            ];
            details.forEach(function(d) {
                html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="' + d.icon + '" style="width:14px;text-align:center;"></i> ' + d.label + '</div>'
                    + '<div style="color:#1a2038;">' + esc(d.value || "\u2014") + '</div>';
            });

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-link" style="width:14px;text-align:center;"></i> Website</div>'
                + '<div style="color:#1a2038;">' + (c.website ? '<a href="' + esc(c.website) + '" target="_blank" style="color:#2f6df0;text-decoration:none;">' + esc(c.website) + '</a>' : '\u2014') + '</div>'
                + '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-history" style="width:14px;text-align:center;"></i> Founded at</div>'
                + '<div style="color:#1a2038;">' + esc(c.found_at || "\u2014") + '</div>'
                + '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-hashtag" style="width:14px;text-align:center;"></i> Specialities</div>'
                + '<div style="display:flex;flex-wrap:wrap;gap:6px;">';

            if (c.specialties && c.specialties.length) {
                c.specialties.forEach(function(sp) {
                    html += '<span style="background:#f0f3ff;color:#4c556f;padding:3px 8px;border-radius:6px;font-size:12px;">' + esc(sp) + '</span>';
                });
            } else html += '\u2014';

            html += '</div>'
                + '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="far fa-compass" style="width:14px;text-align:center;"></i> Tagline</div>'
                + '<div style="color:#1a2038;">' + esc(c.tagline || "\u2014") + '</div>'
                + '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-chart-line" style="width:14px;text-align:center;"></i> Revenue</div>'
                + '<div style="color:#1a2038;">' + esc(c.revenue || "\u2014") + '</div>'
                + '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-users" style="width:14px;text-align:center;"></i> LinkedIn Followers</div>'
                + '<div style="color:#1a2038;">' + esc(c.linkedin_followers || "\u2014") + '</div>'
                + '</div></div></div>';

            // Decision Makers
            html += '<div style="background:#fff;border-top:1px solid #e8ebf2;border-bottom:1px solid #e8ebf2;margin-bottom:16px;">'
                + '<div class="drawer-section" style="border-bottom:none;">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
                + '<div style="font-size:16px;font-weight:700;color:#1a2038;">Potential Decision Makers</div>'
                + '<a href="#" class="drawer-view-employees-link" data-company="' + esc(c.name) + '" data-location="' + esc(c.location_country || c.headquarter || "") + '" style="color:#2f6df0;font-size:12.5px;font-weight:600;text-decoration:none;">View All Employees</a>'
                + '</div>';

            if (c.decision_makers && c.decision_makers.length) {
                html += '<div style="border:1px solid #e8ebf2;border-radius:10px;background:#fff;overflow:hidden;">';
                c.decision_makers.forEach(function(dm) {
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #e8ebf2;">'
                        + '<div style="display:flex;align-items:center;gap:12px;"><div class="avatar-circle" style="width:40px;height:40px;"><span class="initials">' + esc((dm.name || "U").charAt(0)) + '</span></div>'
                        + '<div><div style="font-size:14px;font-weight:600;color:#1a2038;">' + esc(dm.name) + '</div>'
                        + '<div style="font-size:13px;color:#6a7388;margin-top:2px;">' + esc(dm.title || "") + '</div></div></div>'
                        + '<button class="single-save-btn" style="border:1px solid #dce0ea;background:#fff;border-radius:8px;width:34px;height:34px;color:#8a94b0;cursor:pointer;"><i class="far fa-bookmark"></i></button></div>';
                });
                html += '</div>';
            } else html += '<div class="drawer-no-data">No potential decision makers found</div>';

            html += '</div></div></div>';
        });
        return html;
    }

    // ══ Render AJAX results ══
    function renderCompanyAjaxResults(data) {
        var resultsContent = document.querySelector(".results-content");
        if (!resultsContent) return;

        var loaderEl = document.getElementById("searchLoaderOverlay");
        var aiPanel  = document.getElementById("aiSearchPanel");
        if (loaderEl && loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl);
        if (aiPanel  && aiPanel.parentNode)  aiPanel.parentNode.removeChild(aiPanel);
        resultsContent.innerHTML = "";
        document.querySelectorAll(".company-profile-tpl").forEach(function(el) { el.remove(); });
        if (loaderEl) { loaderEl.style.display = "none"; resultsContent.appendChild(loaderEl); }
        if (aiPanel)  resultsContent.appendChild(aiPanel);

        if (data.error && (!data.companies || !data.companies.length)) {
            resultsContent.insertAdjacentHTML("afterbegin", '<div class="error-box"><i class="fas fa-exclamation-circle"></i> ' + esc(data.error) + '</div>');
            if (aiPanel) aiPanel.style.display = "";
            return;
        }

        if (!data.companies || !data.companies.length) {
            resultsContent.insertAdjacentHTML("afterbegin", '<div class="empty-box"><i class="fas fa-building"></i><p>No results yet. Use the filters on the left and hit <strong>Search</strong>.</p></div>');
            if (aiPanel) aiPanel.style.display = "";
            return;
        }

        if (aiPanel) aiPanel.style.display = "none";

        resultsContent.insertAdjacentHTML("afterbegin", buildCompanyResultsHTML(data.companies, data.pagination));

        var resultsPanel = document.querySelector(".results-panel");
        if (resultsPanel) resultsPanel.insertAdjacentHTML("afterend", buildCompanyProfilesHTML(data.companies));

        if (typeof slUpdateSearchPill === "function" && typeof data.search_credits === "number") slUpdateSearchPill(data.search_credits);
        if (typeof slUpdatePill === "function" && typeof data.credits === "number") slUpdatePill(data.credits);

        reattachCompanySelectionEvents();
    }

    function getCompanyFormValues() {
    var form = document.getElementById("companySearchForm");
    if (!form) return {};
    var data = {};
    new FormData(form).forEach(function(val, key) {
        data[key] = val;
    });
    return data;
}

function restoreCompanyFormValues(saved) {
    if (!saved) return;

    // Restore hidden input values
    Object.keys(saved).forEach(function(key) {
        var el = document.querySelector('[name="' + key + '"]');
        if (el && el.type !== "checkbox") el.value = saved[key] || "";
    });

    // Re-render tag inputs visually
    [
        { hiddenInputId:"companyHidden",             tagsContainerId:"companyTags" },
        { hiddenInputId:"companyLocationHidden",     tagsContainerId:"companyLocationTags" },
        { hiddenInputId:"companySpecialitesHidden",  tagsContainerId:"companySpecialitesTags" },
        { hiddenInputId:"companyTechnologiesHidden", tagsContainerId:"companyTechnologiesTags" },
        { hiddenInputId:"jobPostsHidden",            tagsContainerId:"jobPostsTags" },
    ].forEach(function(cfg) {
        var hidden = document.getElementById(cfg.hiddenInputId);
        var cont   = document.getElementById(cfg.tagsContainerId);
        if (!hidden || !cont) return;

        var tags = hidden.value.trim()
            ? hidden.value.split(",").map(function(t){ return t.trim(); }).filter(Boolean)
            : [];

        cont.innerHTML = "";
        tags.forEach(function(t, i) {
            var tag = document.createElement("div");
            tag.className = "tag";
            tag.innerHTML = '<span class="tag-text">' + t + '</span>'
                + '<span class="tag-remove" data-index="' + i + '">&times;</span>';
            cont.appendChild(tag);
        });

        cont.querySelectorAll(".tag-remove").forEach(function(btn) {
            btn.addEventListener("click", function() {
                var idx = parseInt(btn.getAttribute("data-index"), 10);
                tags.splice(idx, 1);
                hidden.value = tags.join(",");
            });
        });
    });

    // Restore industry tags
    var industryHidden  = document.getElementById("industryHidden");
    var industryTagsCont = document.getElementById("industryTagsSelected");
    if (industryHidden && industryTagsCont) {
        var industryTags = industryHidden.value.trim()
            ? industryHidden.value.split(",").map(function(t){ return t.trim(); }).filter(Boolean)
            : [];
        industryTagsCont.innerHTML = "";
        industryTags.forEach(function(val, i) {
            var tag = document.createElement("div");
            tag.className = "tag";
            tag.innerHTML = '<span class="tag-text">' + val + '</span>'
                + '<span class="tag-remove" data-index="' + i + '">&times;</span>';
            industryTagsCont.appendChild(tag);
        });
    }

    // Restore employee count checkboxes
    var employeeHidden = document.getElementById("employeeCountHidden");
    if (employeeHidden && employeeHidden.value) {
        var savedVals = employeeHidden.value.split(",").map(function(v){ return v.trim(); });
        document.querySelectorAll(".employee-count-cb").forEach(function(cb) {
            cb.checked = savedVals.indexOf(cb.value) !== -1;
        });
    }

    // Restore company market checkboxes
    var marketHidden = document.getElementById("companyMarketHidden");
    if (marketHidden && marketHidden.value) {
        var savedMarket = marketHidden.value.split(",").map(function(v){ return v.trim(); });
        document.querySelectorAll(".company-market-cb").forEach(function(cb) {
            cb.checked = savedMarket.indexOf(cb.value) !== -1;
        });
    }
}

    // ══ Shared AJAX fetch helper ══
    function doCompanySearch(pageOverride) {
        if (!companySearchForm) return;
        tagInputInstances.forEach(function(inst) { inst.finalizePendingInput(); });
        showSearchLoader();
        var formData = new FormData(companySearchForm);
        if (pageOverride) formData.set("page", pageOverride);
        fetch(SEARCH_COMPANY_URL, {
            method: "POST",
            headers: { "X-CSRFToken": CSRF_TOKEN, "X-Requested-With": "XMLHttpRequest" },
            body: formData
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            hideSearchLoader();
            if (data.limit_reached) { if (typeof slShowModal === "function") slShowModal(data.credits || 0); return; }
            renderCompanyAjaxResults(data);

            try {
                localStorage.removeItem("company_last_results");
                localStorage.removeItem("company_last_form");
                localStorage.setItem("company_last_results", JSON.stringify(data));
                localStorage.setItem("company_last_form", JSON.stringify(getCompanyFormValues()));
            } catch(e) {}
        })
        .catch(function(err) {
            hideSearchLoader();
            console.error("AJAX company search error:", err);
            showMessage("Search failed. Please try again.", "error");
        });
    }

    var companySearchForm = document.getElementById("companySearchForm");
    if (companySearchForm) {
        companySearchForm.addEventListener("submit", function(e) { e.preventDefault(); doCompanySearch(); });
    }

    window.changeCompanyPage = function(page) { doCompanySearch(page); };

    // ══ Selection events ══
    function reattachCompanySelectionEvents() {
        var cbs = document.querySelectorAll(".row-checkbox");
        var sa  = document.getElementById("selectAllRows");
        var st  = document.getElementById("selectedCountText");
        var sb  = document.getElementById("saveToListBtn");

        function updateUI() {
            if (!st || !sb) return;
            var c = document.querySelectorAll(".row-checkbox:checked").length;
            var t = document.querySelectorAll(".row-checkbox").length;
            st.textContent = c + " selected of " + t + " results";
            sb.style.display = c > 0 ? "inline-flex" : "none";
            if (sa) sa.checked = t > 0 && c === t;
        }

        if (sa) sa.addEventListener("change", function() {
            document.querySelectorAll(".row-checkbox").forEach(function(cb) { cb.checked = sa.checked; });
            updateUI();
        });
        cbs.forEach(function(cb) { cb.addEventListener("change", updateUI); });
        if (sb) sb.addEventListener("click", function() { loadExistingLists().then(function() { setTab("new"); openModal(); }); });
    }

    // ══ Selection & Modal ══
    var rowCheckboxes     = document.querySelectorAll(".row-checkbox");
    var selectAllRows     = document.getElementById("selectAllRows");
    var selectedCountText = document.getElementById("selectedCountText");
    var saveToListBtn     = document.getElementById("saveToListBtn");
    var saveListModal     = document.getElementById("saveListModal");
    var closeSaveListModal = document.getElementById("closeSaveListModal");
    var cancelSaveListBtn = document.getElementById("cancelSaveListBtn");
    var confirmSaveListBtn = document.getElementById("confirmSaveListBtn");
    var newListTab        = document.getElementById("newListTab");
    var existingListTab   = document.getElementById("existingListTab");
    var newListSection    = document.getElementById("newListSection");
    var existingListSection = document.getElementById("existingListSection");
    var newListName       = document.getElementById("newListName");
    var existingListSelect = document.getElementById("existingListSelect");
    var activeListMode    = "new";

    function updateSelectionUI() {
        if (!selectedCountText || !saveToListBtn) return;
        var c = document.querySelectorAll(".row-checkbox:checked").length;
        selectedCountText.textContent = c + " selected of " + rowCheckboxes.length + " results";
        saveToListBtn.style.display = c > 0 ? "inline-flex" : "none";
        if (selectAllRows) selectAllRows.checked = rowCheckboxes.length > 0 && c === rowCheckboxes.length;
    }

    function collectSelectedCompanies() {
        var selected = [];
        document.querySelectorAll(".row-checkbox:checked").forEach(function(cb) {
            selected.push({
                name: cb.dataset.name || "", linkedin_url: cb.dataset.linkedin_url || "",
                website: cb.dataset.website || "", industry: cb.dataset.industry || "",
                domain: cb.dataset.domain || "", revenue: cb.dataset.revenue || "",
                specialties: cb.dataset.specialties || "", headquarter: cb.dataset.headquarter || "",
                location: cb.dataset.location || "", company_market: cb.dataset.company_market || ""
            });
        });
        return selected;
    }

    function loadExistingLists() {
        if (!existingListSelect) return Promise.resolve();
        return fetch(GET_SAVED_LISTS_URL, { headers: { "X-Requested-With": "XMLHttpRequest" } })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                existingListSelect.innerHTML = '<option value="">Select a list</option>';
                if (data.success && Array.isArray(data.lists)) {
                    data.lists.forEach(function(item) {
                        var opt = document.createElement("option");
                        opt.value = item.id; opt.textContent = item.name;
                        existingListSelect.appendChild(opt);
                    });
                }
            })
            .catch(function(e) { console.error("Failed to load lists:", e); });
    }

    function openModal()  { if (saveListModal) saveListModal.style.display = "flex"; }
    function closeModal() {
        if (saveListModal) saveListModal.style.display = "none";
        if (newListName) newListName.value = "";
        if (existingListSelect) existingListSelect.value = "";
    }

    function setTab(mode) {
        activeListMode = mode;
        if (!newListSection || !existingListSection || !newListTab || !existingListTab) return;
        if (mode === "new") {
            newListSection.style.display = "block"; existingListSection.style.display = "none";
            newListTab.style.background = "#2f6df0"; newListTab.style.color = "#fff";
            existingListTab.style.background = "#eef0f4"; existingListTab.style.color = "#2e374d";
        } else {
            newListSection.style.display = "none"; existingListSection.style.display = "block";
            existingListTab.style.background = "#2f6df0"; existingListTab.style.color = "#fff";
            newListTab.style.background = "#eef0f4"; newListTab.style.color = "#2e374d";
        }
    }

    if (selectAllRows) {
        selectAllRows.addEventListener("change", function() {
            rowCheckboxes.forEach(function(cb) { cb.checked = selectAllRows.checked; });
            updateSelectionUI();
        });
    }
    rowCheckboxes.forEach(function(cb) { cb.addEventListener("change", updateSelectionUI); });
    if (saveToListBtn)     saveToListBtn.addEventListener("click", function() { loadExistingLists().then(function() { setTab("new"); openModal(); }); });
    if (closeSaveListModal) closeSaveListModal.addEventListener("click", closeModal);
    if (cancelSaveListBtn)  cancelSaveListBtn.addEventListener("click", closeModal);
    if (newListTab)  newListTab.addEventListener("click", function() { setTab("new"); });
    if (existingListTab) existingListTab.addEventListener("click", function() { setTab("existing"); loadExistingLists(); });

    if (confirmSaveListBtn) {
        confirmSaveListBtn.addEventListener("click", function() {
            var selected = collectSelectedCompanies();
            if (!selected.length) { showMessage("Please select at least one company.", "error"); return; }

            var payload = { list_type: activeListMode, companies: selected };
            if (activeListMode === "new") {
                var name = newListName ? newListName.value.trim() : "";
                if (!name) { showMessage("Please enter a list name.", "error"); return; }
                payload.list_name = name;
            } else {
                var id = existingListSelect ? existingListSelect.value : "";
                if (!id) { showMessage("Please select an existing list.", "error"); return; }
                payload.list_id = id;
            }

            confirmSaveListBtn.disabled = true;
            confirmSaveListBtn.textContent = "Saving...";

            fetch(SAVE_COMPANIES_TO_LIST_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken"), "X-Requested-With": "XMLHttpRequest" },
                body: JSON.stringify(payload)
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) { showMessage(data.error || "Could not save list.", "error"); return; }
                showMessage(data.message || "Saved successfully.", "success");
                closeModal();
            })
            .catch(function(e) { console.error("Save list error:", e); showMessage("Server error while saving list.", "error"); })
            .finally(function() { confirmSaveListBtn.disabled = false; confirmSaveListBtn.textContent = "Save to List"; });
        });
    }

    // ══ Single row save button ══
    document.addEventListener("click", function(e) {
        var btn = e.target.closest(".single-save-btn");
        if (!btn) return;
        document.querySelectorAll(".row-checkbox").forEach(function(cb) { cb.checked = false; });
        var sa = document.getElementById("selectAllRows"); if (sa) sa.checked = false;
        var row = btn.closest("tr");
        if (row) { var cb = row.querySelector(".row-checkbox"); if (cb) cb.checked = true; }
        updateSelectionUI();
        var sb = document.getElementById("saveToListBtn"); if (sb) sb.click();
    });

    // ══ Tooltip ══
    var tooltipEl = document.createElement("div");
    tooltipEl.className = "global-custom-tooltip";
    document.body.appendChild(tooltipEl);

    document.addEventListener("mouseover", function(e) {
        var t = e.target.closest("[data-tooltip]");
        if (!t || !t.getAttribute("data-tooltip")) return;
        tooltipEl.textContent = t.getAttribute("data-tooltip");
        tooltipEl.classList.add("visible");
        var r = t.getBoundingClientRect();
        var top  = r.bottom + window.scrollY + 6;
        var left = r.left + window.scrollX + (r.width / 2) - (tooltipEl.offsetWidth / 2);
        if (left < 10) left = 10;
        if (left + tooltipEl.offsetWidth > window.innerWidth - 10) left = window.innerWidth - tooltipEl.offsetWidth - 10;
        tooltipEl.style.top = top + "px"; tooltipEl.style.left = left + "px";
    });
    document.addEventListener("mouseout", function(e) { if (e.target.closest("[data-tooltip]")) tooltipEl.classList.remove("visible"); });
    window.addEventListener("scroll", function() { tooltipEl.classList.remove("visible"); });

    // ══ Mobile filter toggle ══
    var mobileFilterBtn = document.getElementById("mobileFilterBtn");
    var filtersPanel    = document.querySelector(".filters-panel");
    var mobileOverlay   = document.createElement("div");
    mobileOverlay.className = "mobile-filter-overlay";
    document.body.appendChild(mobileOverlay);

    if (mobileFilterBtn) mobileFilterBtn.style.display = window.innerWidth <= 860 ? "inline-flex" : "none";

    window.addEventListener("resize", function() {
        if (!mobileFilterBtn) return;
        mobileFilterBtn.style.display = window.innerWidth <= 860 ? "inline-flex" : "none";
        if (window.innerWidth > 860 && filterOpen) closeFilter();
    });

    var filterOpen = false;
    var filterProps = ["position:fixed","left:0","top:0","width:300px","height:100vh","min-height:100vh","overflow-y:auto","padding:0.75rem","z-index:9500","max-height:none","background:#fff"];

    function openFilter() {
        filterOpen = true;
        filterProps.forEach(function(s) { var kv = s.split(":"); filtersPanel.style.setProperty(kv[0], kv.slice(1).join(":"), "important"); });
        mobileFilterBtn.innerHTML = '<i class="fas fa-times"></i> Close';
        mobileFilterBtn.classList.add("active");
        mobileOverlay.classList.add("show");
        document.body.style.overflow = "hidden";
    }
    function closeFilter() {
        filterOpen = false;
        filterProps.forEach(function(s) { filtersPanel.style.removeProperty(s.split(":")[0]); });
        mobileFilterBtn.innerHTML = '<i class="fas fa-filter"></i> Filters';
        mobileFilterBtn.classList.remove("active");
        mobileOverlay.classList.remove("show");
        document.body.style.overflow = "";
    }

    if (mobileFilterBtn && filtersPanel) {
        mobileFilterBtn.addEventListener("click", function() { if (filterOpen) closeFilter(); else openFilter(); });
        mobileOverlay.addEventListener("click", closeFilter);
    }

    // ══ Company Profile Drawer ══
    var companyDrawer        = document.getElementById("companyDrawer");
    var companyDrawerOverlay = document.getElementById("companyDrawerOverlay");
    var closeCompanyDrawer   = document.getElementById("closeCompanyDrawer");
    var companyDrawerContent = document.getElementById("companyDrawerContent");
    var drawerSaveToListBtn  = document.getElementById("drawerSaveToListBtn");
    var viewEmployeesForm    = document.getElementById("viewEmployeesForm");
    var viewEmpCompany       = document.getElementById("viewEmpCompany");
    var viewEmpLocation      = document.getElementById("viewEmpLocation");
    var openDrawerRowIndex   = null;
    var drawerViewEmployeesBtn = document.getElementById("drawerViewEmployeesBtn")

    function openCompanyDrawer() {
        if (!companyDrawer || !companyDrawerOverlay) return;
        companyDrawer.classList.add("open"); companyDrawerOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
    }
    function closeCompanyDrawerFn() {
        if (!companyDrawer || !companyDrawerOverlay) return;
        companyDrawer.classList.remove("open"); companyDrawerOverlay.classList.remove("active");
        document.body.style.overflow = ""; openDrawerRowIndex = null;
    }

    if (closeCompanyDrawer) closeCompanyDrawer.addEventListener("click", closeCompanyDrawerFn);
    if (companyDrawerOverlay) companyDrawerOverlay.addEventListener("click", closeCompanyDrawerFn);
    document.addEventListener("keydown", function(e) { if (e.key === "Escape" && companyDrawer && companyDrawer.classList.contains("open")) closeCompanyDrawerFn(); });

    if (drawerSaveToListBtn) {
        drawerSaveToListBtn.addEventListener("click", function() {
            if (openDrawerRowIndex !== null) {
                document.querySelectorAll(".row-checkbox").forEach(function(cb) { cb.checked = false; });
                var sa = document.getElementById("selectAllRows"); if (sa) sa.checked = false;
                var row = document.getElementById("company-card-" + openDrawerRowIndex);
                if (row) { var cb = row.querySelector(".row-checkbox"); if (cb) cb.checked = true; }
                updateSelectionUI();
            }
            loadExistingLists().then(function() { setTab("new"); openModal(); });
        });
    }
if (drawerViewEmployeesBtn) {
    drawerViewEmployeesBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var company  = drawerViewEmployeesBtn.dataset.company  || "";
        var location = drawerViewEmployeesBtn.dataset.location || "";
        localStorage.removeItem("people_last_results");
        localStorage.removeItem("people_last_form");
        var params = new URLSearchParams();
        if (company)  params.set("company",  company);
        if (location) params.set("location", location);
        params.set("auto_search", "1");
        window.location.href = SEARCH_PEOPLE_URL + "?" + params.toString();
    });
}

    document.addEventListener("click", function(e) {
        // Description toggle
        var descToggle = e.target.closest(".drawer-desc-toggle");
        if (descToggle) {
            var descContent = descToggle.previousElementSibling;
            if (descContent) {
                var icon = descToggle.querySelector("i");
                var text = descToggle.querySelector(".toggle-text");
                var expanded = (descContent.style.webkitLineClamp === "unset");
                descContent.style.webkitLineClamp = expanded ? "3" : "unset";
                descContent.style.lineClamp = expanded ? "3" : "unset";
                if (icon) icon.style.transform = expanded ? "rotate(0deg)" : "rotate(180deg)";
                if (text) text.textContent = expanded ? "Read More" : "Read Less";
            }
        }

        // View all employees link
        var viewAllLink = e.target.closest(".drawer-view-employees-link");
if (viewAllLink && !e.target.closest("#drawerViewEmployeesBtn")) {
    e.preventDefault();
    var company  = viewAllLink.dataset.company  || "";
    var location = viewAllLink.dataset.location || "";
    localStorage.removeItem("people_last_results");
    localStorage.removeItem("people_last_form");
    var params = new URLSearchParams();
    if (company)  params.set("company",  company);
    if (location) params.set("location", location);
    params.set("auto_search", "1");
    window.location.href = SEARCH_PEOPLE_URL + "?" + params.toString();
    return;
}

        // Drawer trigger
        var trigger = e.target.closest(".drawer-trigger");
        if (trigger) {
            var tr = trigger.closest("tr");
            if (tr && tr.id && tr.id.indexOf("company-card-") === 0) {
                var idx = tr.id.replace("company-card-", "");
                var tpl = document.getElementById("company-profile-" + idx);
                if (tpl && companyDrawerContent) {
                    companyDrawerContent.innerHTML = tpl.innerHTML;

                    var dContent = companyDrawerContent.querySelector(".drawer-desc-content");
                    var dToggle  = companyDrawerContent.querySelector(".drawer-desc-toggle");
                    if (dContent && dToggle && dContent.scrollHeight <= dContent.clientHeight) dToggle.style.display = "none";

                    openDrawerRowIndex = idx;
                    var cbEl = tr.querySelector(".row-checkbox");
                    if (viewEmpCompany)  viewEmpCompany.value  = cbEl ? (cbEl.dataset.name        || "") : "";
                    if (viewEmpLocation) viewEmpLocation.value = cbEl ? (cbEl.dataset.headquarter || "") : "";
                    if (drawerViewEmployeesBtn) drawerViewEmployeesBtn.dataset.company  = cbEl ? (cbEl.dataset.name        || "") : "";
                    if (drawerViewEmployeesBtn) drawerViewEmployeesBtn.dataset.location = cbEl ? (cbEl.dataset.headquarter || "") : "";

                    openCompanyDrawer();
                }
            }
        }
    });

    (function restoreLastSearch() {
    try {
        var savedResults = localStorage.getItem("company_last_results");
        var savedForm    = localStorage.getItem("company_last_form");
        if (!savedResults) return;

        var data = JSON.parse(savedResults);
        var form = JSON.parse(savedForm || "{}");

        restoreCompanyFormValues(form);
        renderCompanyAjaxResults(data);
    } catch(e) {}
})();

    setTab("new");
    updateSelectionUI();
});