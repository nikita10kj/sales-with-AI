document.addEventListener("DOMContentLoaded", function () {

    // ── Toast ──
    var customMessage = document.getElementById("customMessage");
    var customMessageText = document.getElementById("customMessageText");
    var closeCustomMessage = document.getElementById("closeCustomMessage");
    var customMessageTimeout;

    function showMessage(message, type) {
        type = type || "success";
        if (!customMessage || !customMessageText) return;
        customMessageText.textContent = message;
        customMessage.classList.remove("custom-message-success", "custom-message-error");
        customMessage.classList.add(type === "error" ? "custom-message-error" : "custom-message-success");
        customMessage.style.display = "block";
        clearTimeout(customMessageTimeout);
        customMessageTimeout = setTimeout(function () {
            customMessage.style.display = "none";
        }, 4000);
    }

    if (closeCustomMessage) {
        closeCustomMessage.addEventListener("click", function () {
            customMessage.style.display = "none";
            clearTimeout(customMessageTimeout);
        });
    }

    // ── Filter accordion ──
    document.querySelectorAll(".filter-toggle").forEach(function (button) {
        button.addEventListener("click", function () {
            var parent = button.closest(".filter-item");
            if (parent) parent.classList.toggle("active");
        });
    });

    // ── Utility ──
    function escapeHtml(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            var cookies = document.cookie.split(";");
            for (var i = 0; i < cookies.length; i++) {
                var cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + "=")) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // ── Tag input system ──
    var tagInputInstances = [];

    function setupTagInput(config) {
        var input = document.getElementById(config.inputId);
        var addBtn = document.getElementById(config.addBtnId);
        var tagsContainer = document.getElementById(config.tagsContainerId);
        var hiddenInput = document.getElementById(config.hiddenInputId);

        if (!input || !addBtn || !tagsContainer || !hiddenInput) return;

        var tags = [];

        if (hiddenInput.value.trim()) {
            tags = hiddenInput.value
                .split(",")
                .map(function (item) { return item.trim(); })
                .filter(function (item) { return item !== ""; });
        }

        function updateHiddenInput() {
            hiddenInput.value = tags.join(",");
        }

        function renderTags() {
            tagsContainer.innerHTML = "";
            tags.forEach(function (tagValue, index) {
                var tag = document.createElement("div");
                tag.className = "tag";
                tag.innerHTML = '<span class="tag-text">' + escapeHtml(tagValue) + '</span>'
                    + '<span class="tag-remove" data-index="' + index + '">&times;</span>';
                tagsContainer.appendChild(tag);
            });
            tagsContainer.querySelectorAll(".tag-remove").forEach(function (removeBtn) {
                removeBtn.addEventListener("click", function () {
                    var index = parseInt(removeBtn.getAttribute("data-index"), 10);
                    tags.splice(index, 1);
                    updateHiddenInput();
                    renderTags();
                });
            });
        }

        function addTag(value) {
            var finalValue = (value !== null && value !== undefined ? value : input.value).trim();
            if (!finalValue) return;
            var alreadyExists = tags.some(function (tag) {
                return tag.toLowerCase() === finalValue.toLowerCase();
            });
            if (alreadyExists) {
                input.value = "";
                input.focus();
                return;
            }
            tags.push(finalValue);
            updateHiddenInput();
            renderTags();
            input.value = "";
            input.focus();
        }

        function finalizePendingInput() {
            var pendingValue = input.value.trim();
            if (pendingValue) addTag(pendingValue);
        }

        addBtn.addEventListener("click", function () { addTag(); });

        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                addTag();
            }
            if (e.key === ",") {
                e.preventDefault();
                var inputValue = input.value.trim();
                if (inputValue) {
                    var values = inputValue.split(",")
                        .map(function (v) { return v.trim(); })
                        .filter(function (v) { return v !== ""; });
                    values.forEach(function (v) { addTag(v); });
                }
                input.focus();
            }
            if (e.key === "Backspace" && !input.value.trim() && tags.length) {
                tags.pop();
                updateHiddenInput();
                renderTags();
            }
        });

        renderTags();
        updateHiddenInput();
        tagInputInstances.push({ finalizePendingInput: finalizePendingInput });
    }

    setupTagInput({ inputId: "companyInput",             addBtnId: "addCompanyTag",             tagsContainerId: "companyTags",             hiddenInputId: "companyHidden" });
    setupTagInput({ inputId: "companyLocationInput",     addBtnId: "addCompanyLocationTag",     tagsContainerId: "companyLocationTags",     hiddenInputId: "companyLocationHidden" });
    setupTagInput({ inputId: "companySpecialitesInput",  addBtnId: "addCompanySpecialitesTag",  tagsContainerId: "companySpecialitesTags",  hiddenInputId: "companySpecialitesHidden" });
    setupTagInput({ inputId: "employeeCountInput",       addBtnId: "addEmployeeCountTag",       tagsContainerId: "employeeCountTags",       hiddenInputId: "employeeCountHidden" });
    setupTagInput({ inputId: "companyTechnologiesInput", addBtnId: "addCompanyTechnologiesTag", tagsContainerId: "companyTechnologiesTags", hiddenInputId: "companyTechnologiesHidden" });
    setupTagInput({ inputId: "jobPostsInput",            addBtnId: "addJobPostsTag",            tagsContainerId: "jobPostsTags",            hiddenInputId: "jobPostsHidden" });

    // ── Employee Count Multi-select Dropdown ──
    (function () {
        var dropdown = document.getElementById("employeeCountDropdown");
        var trigger  = document.getElementById("employeeCountTrigger");
        var hidden   = document.getElementById("employeeCountHidden");
        var placeholder = document.getElementById("employeeCountPlaceholder");
        if (!dropdown || !trigger || !hidden) return;

        if (hidden.value) {
            var saved = hidden.value.split(",").map(function (v) { return v.trim(); }).filter(Boolean);
            dropdown.querySelectorAll(".employee-count-cb").forEach(function (cb) {
                if (saved.indexOf(cb.value) !== -1) cb.checked = true;
            });
            updateEmployeeHidden();
        }

        trigger.addEventListener("click", function (e) {
            e.stopPropagation();
            dropdown.classList.toggle("open");
        });

        document.addEventListener("click", function (e) {
            if (!dropdown.contains(e.target)) dropdown.classList.remove("open");
        });

        dropdown.querySelectorAll(".employee-count-cb").forEach(function (cb) {
            cb.addEventListener("change", updateEmployeeHidden);
        });

        function updateEmployeeHidden() {
            var checked = [];
            dropdown.querySelectorAll(".employee-count-cb:checked").forEach(function (cb) {
                checked.push(cb.value);
            });
            hidden.value = checked.join(",");
            placeholder.textContent = checked.length ? checked.join(", ") : "Select employee count";
            placeholder.style.color = checked.length ? "#1a2038" : "#aab0c4";
        }
    })();

    // ── Industry Autocomplete ──
    (function () {
        var dataEl = document.getElementById("industryChoicesData");
        if (!dataEl) return;
        var INDUSTRIES = JSON.parse(dataEl.textContent);

        var input         = document.getElementById("industryInput");
        var suggestions   = document.getElementById("industrySuggestions");
        var tagsContainer = document.getElementById("industryTagsSelected");
        var hidden        = document.getElementById("industryHidden");

        if (!input || !suggestions || !tagsContainer || !hidden) return;

        var searchBtn = document.querySelector('#companySearchForm button[type="submit"]');

        var selected = hidden.value
            ? hidden.value.split(",").map(function (v) { return v.trim(); }).filter(Boolean)
            : [];

        function validateIndustryInput() {
            var typedValue = input.value.trim();
            if (typedValue) {
                if (searchBtn) {
                    searchBtn.disabled = true;
                    searchBtn.title = "Please select an industry from the suggestions list";
                    searchBtn.style.opacity = "0.5";
                    searchBtn.style.cursor = "not-allowed";
                }
            } else {
                enableSearchBtn();
            }
        }

        function enableSearchBtn() {
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.title = "";
                searchBtn.style.opacity = "";
                searchBtn.style.cursor = "";
            }
        }

        function renderTags() {
            tagsContainer.innerHTML = "";
            selected.forEach(function (val, i) {
                var tag = document.createElement("div");
                tag.className = "tag";
                tag.innerHTML = '<span class="tag-text">' + escapeHtml(val) + '</span>'
                    + '<span class="tag-remove" data-index="' + i + '">&times;</span>';
                tagsContainer.appendChild(tag);
            });
            tagsContainer.querySelectorAll(".tag-remove").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    selected.splice(parseInt(btn.dataset.index), 1);
                    updateHidden();
                    renderTags();
                });
            });
        }

        function updateHidden() {
            hidden.value = selected.join(",");
        }

        function showSuggestions(query) {
            var q = query.toLowerCase().trim();
            if (!q) { suggestions.style.display = "none"; return; }

            var matches = INDUSTRIES.filter(function (ind) {
                return ind.toLowerCase().indexOf(q) !== -1 && selected.indexOf(ind) === -1;
            }).slice(0, 10);

            if (!matches.length) { suggestions.style.display = "none"; return; }

            suggestions.innerHTML = matches.map(function (ind) {
                var highlighted = ind.replace(
                    new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"),
                    "<strong>$1</strong>"
                );
                return '<li data-value="' + escapeHtml(ind) + '" style="'
                    + 'padding:8px 14px;font-size:13px;color:#1a2038;cursor:pointer;'
                    + 'transition:background 0.15s;"'
                    + ' onmouseover="this.style.background=\'#f4f5fb\'"'
                    + ' onmouseout="this.style.background=\'\'">' + highlighted + '</li>';
            }).join("");

            suggestions.querySelectorAll("li").forEach(function (li) {
                li.addEventListener("click", function () {
                    var val = li.dataset.value;
                    if (val && selected.indexOf(val) === -1) {
                        selected.push(val);
                        updateHidden();
                        renderTags();
                    }
                    input.value = "";
                    suggestions.style.display = "none";
                    input.focus();
                    enableSearchBtn();
                });
            });

            suggestions.style.display = "block";
        }

        input.addEventListener("input", function () {
            showSuggestions(input.value);
            validateIndustryInput();
        });

        input.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                suggestions.style.display = "none";
                input.value = "";
                validateIndustryInput();
            }
        });

        document.addEventListener("click", function (e) {
            if (!input.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = "none";
                if (input.value.trim()) {
                    input.value = "";
                    enableSearchBtn();
                }
            }
        });

        renderTags();
        updateHidden();
    })();

    // ── Company Market Dropdown ──
    (function () {
        var dropdown    = document.getElementById("companyMarketDropdown");
        var trigger     = document.getElementById("companyMarketTrigger");
        var hidden      = document.getElementById("companyMarketHidden");
        var placeholder = document.getElementById("companyMarketPlaceholder");
        var options     = document.getElementById("companyMarketOptions");

        if (!dropdown || !trigger || !hidden) return;

        if (hidden.value) {
            var saved = hidden.value.split(",").map(function (v) { return v.trim(); }).filter(Boolean);
            dropdown.querySelectorAll(".company-market-cb").forEach(function (cb) {
                if (saved.indexOf(cb.value) !== -1) cb.checked = true;
            });
            updateMarketHidden();
        }

        trigger.addEventListener("click", function (e) {
            e.stopPropagation();
            var isOpen = options.style.display !== "none";
            options.style.display = isOpen ? "none" : "block";
            dropdown.classList.toggle("open", !isOpen);
        });

        document.addEventListener("click", function (e) {
            if (!dropdown.contains(e.target)) {
                options.style.display = "none";
                dropdown.classList.remove("open");
            }
        });

        dropdown.querySelectorAll(".company-market-cb").forEach(function (cb) {
            cb.addEventListener("change", updateMarketHidden);
        });

        function updateMarketHidden() {
            var checked = [];
            dropdown.querySelectorAll(".company-market-cb:checked").forEach(function (cb) {
                checked.push(cb.value);
            });
            hidden.value = checked.join(",");
            placeholder.textContent = checked.length ? checked.join(", ") : "Select market type";
            placeholder.style.color = checked.length ? "#1a2038" : "#aab0c4";
        }
    })();

    var companySearchForm = document.getElementById("companySearchForm");

    function showSearchLoader() {
        var el = document.getElementById("searchLoaderOverlay");
        if (el) el.style.display = "flex";
    }
    function hideSearchLoader() {
        var el = document.getElementById("searchLoaderOverlay");
        if (el) el.style.display = "none";
    }

    function buildCompanyResultsHTML(companies, pagination) {
        if (!companies || !companies.length) {
            return '<div class="empty-box"><i class="fas fa-building"></i><p>No results found. Try different filters.</p></div>';
        }

        var html = '<div class="results-card">';

        var cur      = (pagination && pagination.current) || 1;
        var total    = (pagination && pagination.total)   || 0;
        var pageSize = companies.length;
        var startIdx = (cur - 1) * pageSize + 1;
        var endIdx   = Math.min(startIdx + pageSize - 1, total);

        html += '<div class="results-meta"><div class="results-meta-left">'
            + '<input type="checkbox" id="selectAllRows">'
            + ' <i class="fas fa-chevron-down" style="font-size:11px;color:#aab0c4;cursor:pointer;"></i>'
            + ' <span id="selectedCountText">0 selected of ' + companies.length + ' results</span>'
            + '</div><div class="results-meta-right">'
            + '<span style="font-size:13px;color:#6a7388;margin-right:12px;">' + startIdx + '\u2013' + endIdx + ' of ' + total + '</span>'
            + '<button type="button" id="saveToListBtn" class="save-list-btn" style="display:none;"><i class="fas fa-plus"></i> Save to List</button>'
            + '</div></div>';

        html += '<div class="table-wrap"><table class="results-table"><thead><tr>'
            + '<th class="col-chk"></th><th>Company</th><th>Description</th>'
            + '<th>HQ Location</th><th>Industry</th><th>Company Size</th><th>Actions</th>'
            + '</tr></thead><tbody>';

        companies.forEach(function (c, i) {
            var idx = i + 1;
            var avatarClass = c.logo_url ? 'company-avatar' : 'company-avatar fallback-avatar';

            html += '<tr id="company-card-' + idx + '">';

            html += '<td class="col-chk"><input type="checkbox" class="row-checkbox"'
                + ' data-name="' + escapeHtml(c.name) + '"'
                + ' data-linkedin_url="' + escapeHtml(c.linkedin_url || "") + '"'
                + ' data-website="' + escapeHtml(c.website || "") + '"'
                + ' data-industry="' + escapeHtml(c.industry || "") + '"'
                + ' data-description="' + escapeHtml(c.description || "") + '"'
                + ' data-company_size="' + escapeHtml(c.company_size || "") + '"'
                + ' data-headquarter="' + escapeHtml(c.headquarter || "") + '"'
                + '></td>';

            html += '<td class="drawer-trigger"><div class="profile-cell">';
            if (c.linkedin_url) html += '<a href="' + escapeHtml(c.linkedin_url) + '" target="_blank" class="avatar-link" title="View on LinkedIn">';
            html += '<div class="' + avatarClass + '">';
            if (c.logo_url) html += '<img src="' + escapeHtml(c.logo_url) + '" alt="Company Logo" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'fallback-avatar\');">';
            html += '<div class="avatar-placeholder"><span class="shape shape1"></span><span class="shape shape2"></span></div>';
            html += '</div>';
            if (c.linkedin_url) html += '</a>';
            html += '<div class="profile-info"><span class="profile-name drawer-trigger" data-tooltip="' + escapeHtml(c.name) + '">' + escapeHtml(c.name || "\u2014") + '</span>';
            if (c.linkedin_url) html += '<a href="' + escapeHtml(c.linkedin_url) + '" target="_blank" class="li-badge" title="LinkedIn">in</a>';
            html += '</div></div></td>';

            html += '<td class="cell-truncate cell-desc drawer-trigger">' + escapeHtml(c.description || "\u2014") + '</td>';

            html += '<td class="cell-truncate drawer-trigger"' + (c.headquarter ? ' data-tooltip="' + escapeHtml(c.headquarter) + '"' : '') + '>';
            html += c.headquarter ? '<span class="cell-icon"><i class="fas fa-map-marker-alt"></i></span>' + escapeHtml(c.headquarter) : '\u2014';
            html += '</td>';

            html += '<td class="cell-truncate drawer-trigger"' + (c.industry ? ' data-tooltip="' + escapeHtml(c.industry) + '"' : '') + '>';
            html += c.industry ? '<span class="cell-icon"><i class="fas fa-industry"></i></span>' + escapeHtml(c.industry) : '\u2014';
            html += '</td>';

            html += '<td class="cell-truncate"' + (c.company_size ? ' data-tooltip="' + escapeHtml(c.company_size) + ' employees"' : '') + '>';
            html += c.company_size ? '<span class="cell-icon"><i class="fas fa-users"></i></span>' + escapeHtml(c.company_size) : '\u2014';
            html += '</td>';

            html += '<td><div class="action-icons">';
            if (c.linkedin_url) html += '<a href="' + escapeHtml(c.linkedin_url) + '" target="_blank" title="View LinkedIn"><i class="fab fa-linkedin-in"></i></a>';
            else html += '<button type="button" title="LinkedIn N/A" disabled><i class="fab fa-linkedin-in"></i></button>';
            if (c.website) html += '<a href="' + escapeHtml(c.website) + '" target="_blank" title="Visit Website"><i class="fas fa-external-link-alt"></i></a>';
            else html += '<button type="button" title="Website N/A" disabled><i class="fas fa-external-link-alt"></i></button>';
            html += '<button type="button" title="Save to List" class="single-save-btn"><i class="far fa-bookmark"></i></button>';
            html += '</div></td>';

            html += '</tr>';
        });

        html += '</tbody></table></div>';

        var totalPages = (pagination && pagination.total_pages) || (pagination && pagination.last_page) || 1;
        var hasNext    = pagination && pagination.has_next;

        function buildPageRange(cur, totalPgs, win) {
            var pages = [];
            var left  = Math.max(1, cur - win);
            var right = Math.min(totalPgs, cur + win);
            if (left > 1)  { pages.push(1); if (left > 2) pages.push(-1); }
            for (var p = left; p <= right; p++) pages.push(p);
            if (right < totalPgs) { if (right < totalPgs - 1) pages.push(-1); pages.push(totalPgs); }
            return pages;
        }

        var pageRange = (pagination && pagination.page_range) || buildPageRange(cur, totalPages, 2);

        html += '<div class="results-footer"><div class="pagination-wrap">';

        html += '<button class="page-btn page-btn-text" type="button"'
            + (cur <= 1 ? ' disabled' : ' onclick="changeCompanyPage(1)"')
            + '>&lt;&lt; First</button>';

        html += '<button class="page-btn page-btn-text" type="button"'
            + (cur <= 1 ? ' disabled' : ' onclick="changeCompanyPage(' + (cur - 1) + ')"')
            + '>&lt; Prev</button>';

        pageRange.forEach(function (p) {
            if (p === -1) {
                html += '<span class="page-ellipsis">\u2026</span>';
            } else if (p === cur) {
                html += '<button class="page-btn page-num active" type="button">' + p + '</button>';
            } else {
                html += '<button class="page-btn page-num" type="button" onclick="changeCompanyPage(' + p + ')">' + p + '</button>';
            }
        });

        html += '<button class="page-btn page-btn-text" type="button"'
            + (hasNext ? ' onclick="changeCompanyPage(' + (cur + 1) + ')"' : ' disabled')
            + '>Next &gt;</button>';

        html += '<button class="page-btn page-btn-text" type="button"'
            + (cur >= totalPages ? ' disabled' : ' onclick="changeCompanyPage(' + totalPages + ')"')
            + '>Last &gt;&gt;</button>';

        html += '</div></div>';
        html += '</div>';
        return html;
    }

    function buildCompanyProfilesHTML(companies) {
        var html = '';
        companies.forEach(function (c, i) {
            var idx = i + 1;
            var initial = (c.name || "C").charAt(0);

            html += '<div id="company-profile-' + idx + '" class="company-profile-tpl" style="display:none;" aria-hidden="true">';

            html += '<div style="background:#fff;margin:0 0 16px 0;border-bottom:1px solid #e8ebf2;">';
            html += '<div class="drawer-hero" style="border-bottom:none;"><div class="drawer-hero-top">';
            html += '<div class="drawer-avatar" style="border-radius:10px;border:1px solid #e0e4f0;background:#fff;padding:4px;">';
            if (c.logo_url) {
                html += '<img src="' + escapeHtml(c.logo_url) + '" alt="' + escapeHtml(c.name) + '" style="border-radius:6px;object-fit:contain;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">';
                html += '<span class="drawer-avatar-initials" style="display:none;color:#1a2038;">' + escapeHtml(initial) + '</span>';
            } else {
                html += '<span class="drawer-avatar-initials" style="color:#1a2038;">' + escapeHtml(initial) + '</span>';
            }
            html += '</div><div class="drawer-name-block"><div class="drawer-name">';
            if (c.linkedin_url) {
                html += '<a href="' + escapeHtml(c.linkedin_url) + '" target="_blank" style="color:inherit;text-decoration:none;">' + escapeHtml(c.name) + '</a>';
                html += ' <a href="' + escapeHtml(c.linkedin_url) + '" target="_blank" class="li-badge" title="LinkedIn" style="text-decoration:none;">in</a>';
            } else html += escapeHtml(c.name);
            if (c.website) html += ' <a href="' + escapeHtml(c.website) + '" target="_blank" style="margin-left:6px;color:#6a7388;font-size:14px;"><i class="fas fa-link"></i></a>';
            html += '</div></div></div>';

            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
            html += '<div class="drawer-meta-item"><i class="fas fa-map-marker-alt"></i><span>' + escapeHtml(c.location_country || c.headquarter || "\u2014") + '</span></div>';
            if (c.linkedin_url) html += '<a href="' + escapeHtml(c.linkedin_url) + '" target="_blank" style="color:#2f6df0;font-size:12.5px;font-weight:600;text-decoration:none;">View Company Profile</a>';
            html += '</div>';

            if (c.description) {
                html += '<div style="background:#f4f5fb;border-radius:10px;border:1px solid #e8ebf2;padding:12px 14px;">';
                html += '<div style="font-size:13px;color:#4c556f;line-height:1.6;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;line-clamp:3;-webkit-box-orient:vertical;" class="drawer-desc-content">' + escapeHtml(c.description) + '</div>';
                html += '<button type="button" class="drawer-desc-toggle" style="border:none;background:none;color:#6a7388;font-size:13px;font-weight:500;cursor:pointer;padding:0;margin-top:8px;display:inline-flex;align-items:center;gap:6px;font-family:\'Inter\',sans-serif;"><i class="fas fa-chevron-down" style="font-size:10px;transition:transform 0.2s;"></i> <span class="toggle-text">Read More</span></button>';
                html += '</div>';
            }
            html += '</div></div>';

            html += '<div style="background:#fff;border-top:1px solid #e8ebf2;border-bottom:1px solid #e8ebf2;margin-bottom:16px;">';
            html += '<div class="drawer-section" style="border-bottom:none;">';
            html += '<div style="font-size:16px;font-weight:700;color:#1a2038;margin-bottom:16px;">Basic Details</div>';
            html += '<div style="display:grid;grid-template-columns:140px 1fr;gap:12px;font-size:13px;color:#4c556f;">';

            var details = [
                {icon: "far fa-user",        label: "Company Size", value: c.company_size || "\u2014"},
                {icon: "fas fa-map-marker-alt", label: "HQ Location", value: c.headquarter || "\u2014"},
                {icon: "far fa-building",    label: "Industry",     value: c.industry || "\u2014"}
            ];
            details.forEach(function (d) {
                html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="' + d.icon + '" style="width:14px;text-align:center;"></i> ' + d.label + '</div>';
                html += '<div style="color:#1a2038;">' + escapeHtml(d.value) + '</div>';
            });

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-link" style="width:14px;text-align:center;"></i> Website</div>';
            if (c.website) html += '<div style="color:#1a2038;"><a href="' + escapeHtml(c.website) + '" target="_blank" style="color:#2f6df0;text-decoration:none;">' + escapeHtml(c.website) + '</a></div>';
            else html += '<div style="color:#1a2038;">\u2014</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-history" style="width:14px;text-align:center;"></i> Founded at</div>';
            html += '<div style="color:#1a2038;">' + escapeHtml(c.found_at || "\u2014") + '</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-hashtag" style="width:14px;text-align:center;"></i> Specialities</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
            if (c.specialties && c.specialties.length) {
                c.specialties.forEach(function (sp) {
                    html += '<span style="background:#f0f3ff;color:#4c556f;padding:3px 8px;border-radius:6px;font-size:12px;">' + escapeHtml(sp) + '</span>';
                });
            } else html += '\u2014';
            html += '</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="far fa-compass" style="width:14px;text-align:center;"></i> Tagline</div>';
            html += '<div style="color:#1a2038;">' + escapeHtml(c.tagline || "\u2014") + '</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-chart-line" style="width:14px;text-align:center;"></i> Revenue</div>';
            html += '<div style="color:#1a2038;">' + escapeHtml(c.revenue || "\u2014") + '</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-users" style="width:14px;text-align:center;"></i> LinkedIn Followers</div>';
            html += '<div style="color:#1a2038;">' + escapeHtml(c.linkedin_followers || "\u2014") + '</div>';

            html += '</div></div></div>';

            html += '<div style="background:#fff;border-top:1px solid #e8ebf2;border-bottom:1px solid #e8ebf2;margin-bottom:16px;">';
            html += '<div class="drawer-section" style="border-bottom:none;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
            html += '<div style="font-size:16px;font-weight:700;color:#1a2038;">Potential Decision Makers</div>';
            html += '<a href="#" class="drawer-view-employees-link" data-company="' + escapeHtml(c.name) + '" data-location="' + escapeHtml(c.location_country || c.headquarter || "") + '" style="color:#2f6df0;font-size:12.5px;font-weight:600;text-decoration:none;">View All Employees</a>';
            html += '</div>';

            if (c.decision_makers && c.decision_makers.length) {
                html += '<div style="border:1px solid #e8ebf2;border-radius:10px;background:#fff;overflow:hidden;">';
                c.decision_makers.forEach(function (dm) {
                    var dmInitial = (dm.name || "U").charAt(0);
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #e8ebf2;">';
                    html += '<div style="display:flex;align-items:center;gap:12px;"><div class="avatar-circle" style="width:40px;height:40px;"><span class="initials">' + escapeHtml(dmInitial) + '</span></div>';
                    html += '<div><div style="font-size:14px;font-weight:600;color:#1a2038;">' + escapeHtml(dm.name) + '</div>';
                    html += '<div style="font-size:13px;color:#6a7388;margin-top:2px;">' + escapeHtml(dm.title || "") + '</div></div></div>';
                    html += '<button class="single-save-btn" style="border:1px solid #dce0ea;background:#fff;border-radius:8px;width:34px;height:34px;color:#8a94b0;cursor:pointer;"><i class="far fa-bookmark"></i></button>';
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html += '<div class="drawer-no-data">No potential decision makers found</div>';
            }
            html += '</div></div>';
            html += '</div>';
        });
        return html;
    }

    function renderCompanyAjaxResults(data) {
        var resultsContent = document.querySelector(".results-content");
        if (!resultsContent) return;

        function clearResultsContent() {
            var loaderEl = document.getElementById("searchLoaderOverlay");
            var aiPanel  = document.getElementById("aiSearchPanel");
            if (loaderEl && loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl);
            if (aiPanel  && aiPanel.parentNode)  aiPanel.parentNode.removeChild(aiPanel);
            resultsContent.innerHTML = "";
            document.querySelectorAll(".company-profile-tpl").forEach(function (el) { el.remove(); });
            if (loaderEl) { loaderEl.style.display = "none"; resultsContent.appendChild(loaderEl); }
            if (aiPanel)  resultsContent.appendChild(aiPanel);
        }

        clearResultsContent();

        var aiPanel = document.getElementById("aiSearchPanel");

        if (data.error && (!data.companies || !data.companies.length)) {
            resultsContent.insertAdjacentHTML("afterbegin", '<div class="error-box"><i class="fas fa-exclamation-circle"></i> ' + escapeHtml(data.error) + '</div>');
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

        if (sa) sa.addEventListener("change", function () {
            document.querySelectorAll(".row-checkbox").forEach(function (cb) { cb.checked = sa.checked; });
            updateUI();
        });
        cbs.forEach(function (cb) { cb.addEventListener("change", updateUI); });
        if (sb) sb.addEventListener("click", function () {
            loadExistingLists().then(function () {
                setTab("new");
                openModal();
            });
        });

        var cp = document.getElementById("contactPill");
        if (cp) cp.textContent = "0/" + cbs.length;
    }

    if (companySearchForm) {
        companySearchForm.addEventListener("submit", function (e) {
            e.preventDefault();

            tagInputInstances.forEach(function (instance) {
                instance.finalizePendingInput();
            });

            showSearchLoader();

            var formData = new FormData(companySearchForm);

            fetch(SEARCH_COMPANY_URL, {
                method: "POST",
                headers: {
                    "X-CSRFToken": CSRF_TOKEN,
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: formData
            })
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                hideSearchLoader();
                if (data.limit_reached) {
                    if (typeof slShowModal === "function") slShowModal(data.credits || 0);
                    return;
                }
                renderCompanyAjaxResults(data);
            })
            .catch(function (err) {
                hideSearchLoader();
                console.error("AJAX company search error:", err);
                showMessage("Search failed. Please try again.", "error");
            });
        });
    }

    window.changeCompanyPage = function (pageNumber) {
        if (!companySearchForm) return;

        tagInputInstances.forEach(function (instance) {
            instance.finalizePendingInput();
        });

        showSearchLoader();

        var formData = new FormData(companySearchForm);
        formData.set("page", pageNumber);

        fetch(SEARCH_COMPANY_URL, {
            method: "POST",
            headers: {
                "X-CSRFToken": CSRF_TOKEN,
                "X-Requested-With": "XMLHttpRequest"
            },
            body: formData
        })
        .then(function (resp) { return resp.json(); })
        .then(function (data) {
            hideSearchLoader();
            if (data.limit_reached) {
                if (typeof slShowModal === "function") slShowModal(data.credits || 0);
                return;
            }
            renderCompanyAjaxResults(data);
        })
        .catch(function (err) {
            hideSearchLoader();
            console.error("AJAX company search error:", err);
            showMessage("Search failed. Please try again.", "error");
        });
    };

    // ── Selection & Save to List ──
    var rowCheckboxes    = document.querySelectorAll(".row-checkbox");
    var selectAllRows    = document.getElementById("selectAllRows");
    var selectedCountText = document.getElementById("selectedCountText");
    var saveToListBtn    = document.getElementById("saveToListBtn");

    var saveListModal      = document.getElementById("saveListModal");
    var closeSaveListModal = document.getElementById("closeSaveListModal");
    var cancelSaveListBtn  = document.getElementById("cancelSaveListBtn");
    var confirmSaveListBtn = document.getElementById("confirmSaveListBtn");

    var newListTab         = document.getElementById("newListTab");
    var existingListTab    = document.getElementById("existingListTab");
    var newListSection     = document.getElementById("newListSection");
    var existingListSection = document.getElementById("existingListSection");
    var newListName        = document.getElementById("newListName");
    var existingListSelect = document.getElementById("existingListSelect");

    var activeListMode = "new";

    function updateSelectionUI() {
        if (!selectedCountText || !saveToListBtn) return;
        var checkedCount = document.querySelectorAll(".row-checkbox:checked").length;
        var totalCount   = rowCheckboxes.length;
        selectedCountText.textContent = checkedCount + " selected of " + totalCount + " results";
        saveToListBtn.style.display = checkedCount > 0 ? "inline-flex" : "none";
        if (selectAllRows) {
            selectAllRows.checked = totalCount > 0 && checkedCount === totalCount;
        }
    }

    function collectSelectedCompanies() {
        var selected = [];
        document.querySelectorAll(".row-checkbox:checked").forEach(function (cb) {
            selected.push({
                name:           cb.dataset.name           || "",
                linkedin_url:   cb.dataset.linkedin_url   || "",
                website:        cb.dataset.website        || "",
                industry:       cb.dataset.industry       || "",
                domain:         cb.dataset.domain         || "",
                revenue:        cb.dataset.revenue        || "",
                specialties:    cb.dataset.specialties    || "",
                headquarter:    cb.dataset.headquarter    || "",
                location:       cb.dataset.location       || "",
                company_market: cb.dataset.company_market || ""
            });
        });
        return selected;
    }

    function loadExistingLists() {
        if (!existingListSelect) return Promise.resolve();
        return fetch(GET_SAVED_LISTS_URL, {
            method: "GET",
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            existingListSelect.innerHTML = '<option value="">Select a list</option>';
            if (data.success && Array.isArray(data.lists)) {
                data.lists.forEach(function (item) {
                    var option = document.createElement("option");
                    option.value = item.id;
                    option.textContent = item.name;
                    existingListSelect.appendChild(option);
                });
            }
        })
        .catch(function (error) {
            console.error("Failed to load existing lists:", error);
        });
    }

    function openModal() {
        if (saveListModal) saveListModal.style.display = "flex";
    }

    function closeModal() {
        if (saveListModal) saveListModal.style.display = "none";
        if (newListName) newListName.value = "";
        if (existingListSelect) existingListSelect.value = "";
    }

    function setTab(mode) {
        activeListMode = mode;
        if (!newListSection || !existingListSection || !newListTab || !existingListTab) return;
        if (mode === "new") {
            newListSection.style.display = "block";
            existingListSection.style.display = "none";
            newListTab.style.background = "#2f6df0";
            newListTab.style.color = "#fff";
            existingListTab.style.background = "#eef0f4";
            existingListTab.style.color = "#2e374d";
        } else {
            newListSection.style.display = "none";
            existingListSection.style.display = "block";
            existingListTab.style.background = "#2f6df0";
            existingListTab.style.color = "#fff";
            newListTab.style.background = "#eef0f4";
            newListTab.style.color = "#2e374d";
        }
    }

    if (selectAllRows) {
        selectAllRows.addEventListener("change", function () {
            rowCheckboxes.forEach(function (cb) { cb.checked = selectAllRows.checked; });
            updateSelectionUI();
        });
    }

    rowCheckboxes.forEach(function (cb) {
        cb.addEventListener("change", updateSelectionUI);
    });

    if (saveToListBtn) {
        saveToListBtn.addEventListener("click", function () {
            loadExistingLists().then(function () {
                setTab("new");
                openModal();
            });
        });
    }

    if (closeSaveListModal) closeSaveListModal.addEventListener("click", closeModal);
    if (cancelSaveListBtn) cancelSaveListBtn.addEventListener("click", closeModal);

    if (newListTab) {
        newListTab.addEventListener("click", function () { setTab("new"); });
    }
    if (existingListTab) {
        existingListTab.addEventListener("click", function () {
            setTab("existing");
            loadExistingLists();
        });
    }

    if (confirmSaveListBtn) {
        confirmSaveListBtn.addEventListener("click", function () {
            var selectedCompanies = collectSelectedCompanies();
            if (!selectedCompanies.length) {
                showMessage("Please select at least one company.", "error");
                return;
            }

            var payload = { list_type: activeListMode, companies: selectedCompanies };

            if (activeListMode === "new") {
                var listName = newListName ? newListName.value.trim() : "";
                if (!listName) { showMessage("Please enter a list name.", "error"); return; }
                payload.list_name = listName;
            } else {
                var listId = existingListSelect ? existingListSelect.value : "";
                if (!listId) { showMessage("Please select an existing list.", "error"); return; }
                payload.list_id = listId;
            }

            confirmSaveListBtn.disabled = true;
            confirmSaveListBtn.textContent = "Saving...";

            fetch(SAVE_COMPANIES_TO_LIST_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: JSON.stringify(payload)
            })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) {
                    showMessage(data.error || "Could not save list.", "error");
                    return;
                }
                showMessage(data.message || "Saved successfully.", "success");
                closeModal();
            })
            .catch(function (error) {
                console.error("Save list error:", error);
                showMessage("Server error while saving list.", "error");
            })
            .finally(function () {
                confirmSaveListBtn.disabled = false;
                confirmSaveListBtn.textContent = "Save to List";
            });
        });
    }

    // ── Single row Save to List button ──
    document.addEventListener("click", function (e) {
        var singleSaveBtn = e.target.closest(".single-save-btn");
        if (singleSaveBtn) {
            document.querySelectorAll(".row-checkbox").forEach(function (cb) { cb.checked = false; });
            var selectAll = document.getElementById("selectAllRows");
            if (selectAll) selectAll.checked = false;

            var row = singleSaveBtn.closest("tr");
            if (row) {
                var cb = row.querySelector(".row-checkbox");
                if (cb) cb.checked = true;
            }

            updateSelectionUI();
            var listBtn = document.getElementById("saveToListBtn");
            if (listBtn) listBtn.click();
        }
    });

    // ── Global Tooltip ──
    var tooltipEl = document.createElement("div");
    tooltipEl.className = "global-custom-tooltip";
    document.body.appendChild(tooltipEl);

    document.addEventListener("mouseover", function (e) {
        var target = e.target.closest("[data-tooltip]");
        if (!target) return;
        var text = target.getAttribute("data-tooltip");
        if (!text) return;
        tooltipEl.textContent = text;
        tooltipEl.classList.add("visible");
        var rect = target.getBoundingClientRect();
        var top  = rect.bottom + window.scrollY + 6;
        var left = rect.left + window.scrollX + (rect.width / 2) - (tooltipEl.offsetWidth / 2);
        if (left < 10) left = 10;
        if (left + tooltipEl.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltipEl.offsetWidth - 10;
        }
        tooltipEl.style.top  = top + "px";
        tooltipEl.style.left = left + "px";
    });

    document.addEventListener("mouseout", function (e) {
        if (e.target.closest("[data-tooltip]")) {
            tooltipEl.classList.remove("visible");
        }
    });

    window.addEventListener("scroll", function () { tooltipEl.classList.remove("visible"); });

    // ── Mobile Filter Toggle ──
    var mobileFilterBtn = document.getElementById("mobileFilterBtn");
    var filtersPanel    = document.querySelector(".filters-panel");
    var mobileOverlay   = document.createElement("div");
    mobileOverlay.className = "mobile-filter-overlay";
    document.body.appendChild(mobileOverlay);

    if (mobileFilterBtn) {
        mobileFilterBtn.style.display = window.innerWidth <= 860 ? "inline-flex" : "none";
    }

    window.addEventListener("resize", function () {
        if (!mobileFilterBtn) return;
        if (window.innerWidth <= 860) {
            mobileFilterBtn.style.display = "inline-flex";
        } else {
            mobileFilterBtn.style.display = "none";
            if (filterOpen) closeFilter();
        }
    });

    if (mobileFilterBtn && filtersPanel) {
        var filterOpen = false;

        function openFilter() {
            filterOpen = true;
            filtersPanel.style.setProperty("position",   "fixed",   "important");
            filtersPanel.style.setProperty("left",       "0",       "important");
            filtersPanel.style.setProperty("top",        "0",       "important");
            filtersPanel.style.setProperty("width",      "300px",   "important");
            filtersPanel.style.setProperty("height",     "100vh",   "important");
            filtersPanel.style.setProperty("min-height", "100vh",   "important");
            filtersPanel.style.setProperty("overflow-y", "auto",    "important");
            filtersPanel.style.setProperty("padding",    "0.75rem", "important");
            filtersPanel.style.setProperty("z-index",    "9500",    "important");
            filtersPanel.style.setProperty("max-height", "none",    "important");
            filtersPanel.style.setProperty("background", "#fff",    "important");
            mobileFilterBtn.innerHTML = '<i class="fas fa-times"></i> Close';
            mobileFilterBtn.classList.add("active");
            mobileOverlay.classList.add("show");
            document.body.style.overflow = "hidden";
        }

        function closeFilter() {
            filterOpen = false;
            filtersPanel.style.removeProperty("position");
            filtersPanel.style.removeProperty("left");
            filtersPanel.style.removeProperty("top");
            filtersPanel.style.removeProperty("width");
            filtersPanel.style.removeProperty("height");
            filtersPanel.style.removeProperty("min-height");
            filtersPanel.style.removeProperty("overflow-y");
            filtersPanel.style.removeProperty("padding");
            filtersPanel.style.removeProperty("z-index");
            filtersPanel.style.removeProperty("max-height");
            filtersPanel.style.removeProperty("background");
            mobileFilterBtn.innerHTML = '<i class="fas fa-filter"></i> Filters';
            mobileFilterBtn.classList.remove("active");
            mobileOverlay.classList.remove("show");
            document.body.style.overflow = "";
        }

        mobileFilterBtn.addEventListener("click", function () {
            if (filterOpen) { closeFilter(); } else { openFilter(); }
        });
        mobileOverlay.addEventListener("click", function () { closeFilter(); });
    }

    // ── Profile Drawer Logic ──
    var companyDrawer         = document.getElementById("companyDrawer");
    var companyDrawerOverlay  = document.getElementById("companyDrawerOverlay");
    var closeCompanyDrawer    = document.getElementById("closeCompanyDrawer");
    var companyDrawerContent  = document.getElementById("companyDrawerContent");
    var drawerViewEmployeesBtn = document.getElementById("drawerViewEmployeesBtn");
    var drawerSaveToListBtn   = document.getElementById("drawerSaveToListBtn");
    var viewEmployeesForm     = document.getElementById("viewEmployeesForm");
    var viewEmpCompany        = document.getElementById("viewEmpCompany");
    var viewEmpLocation       = document.getElementById("viewEmpLocation");

    var openDrawerRowIndex = null;

    function openCompanyDrawer() {
        if (!companyDrawer || !companyDrawerOverlay) return;
        companyDrawer.classList.add("open");
        companyDrawerOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeCompanyDrawerFn() {
        if (!companyDrawer || !companyDrawerOverlay) return;
        companyDrawer.classList.remove("open");
        companyDrawerOverlay.classList.remove("active");
        document.body.style.overflow = "";
        openDrawerRowIndex = null;
    }

    if (closeCompanyDrawer) closeCompanyDrawer.addEventListener("click", closeCompanyDrawerFn);
    if (companyDrawerOverlay) companyDrawerOverlay.addEventListener("click", closeCompanyDrawerFn);

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && companyDrawer && companyDrawer.classList.contains("open")) {
            closeCompanyDrawerFn();
        }
    });

    if (drawerViewEmployeesBtn) {
        drawerViewEmployeesBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (viewEmployeesForm) viewEmployeesForm.submit();
        });
    }

    if (drawerSaveToListBtn) {
        drawerSaveToListBtn.addEventListener("click", function () {
            if (openDrawerRowIndex !== null) {
                document.querySelectorAll(".row-checkbox").forEach(function (cb) { cb.checked = false; });
                var selectAll = document.getElementById("selectAllRows");
                if (selectAll) selectAll.checked = false;

                var row = document.getElementById("company-card-" + openDrawerRowIndex);
                if (row) {
                    var cb = row.querySelector(".row-checkbox");
                    if (cb) cb.checked = true;
                }
                updateSelectionUI();
            }
            loadExistingLists().then(function () {
                setTab("new");
                openModal();
            });
        });
    }

    document.addEventListener("click", function (e) {
        var descToggle = e.target.closest(".drawer-desc-toggle");
        if (descToggle) {
            var descContent = descToggle.previousElementSibling;
            if (descContent) {
                var icon = descToggle.querySelector("i");
                var text = descToggle.querySelector(".toggle-text");
                var isExpanded = (descContent.style.webkitLineClamp === "unset");
                if (isExpanded) {
                    descContent.style.webkitLineClamp = "3";
                    descContent.style.lineClamp = "3";
                    if (icon) icon.style.transform = "rotate(0deg)";
                    if (text) text.textContent = "Read More";
                } else {
                    descContent.style.webkitLineClamp = "unset";
                    descContent.style.lineClamp = "unset";
                    if (icon) icon.style.transform = "rotate(180deg)";
                    if (text) text.textContent = "Read Less";
                }
            }
        }

        var viewAllLink = e.target.closest(".drawer-view-employees-link");
        if (viewAllLink) {
            e.preventDefault();
            var cName = viewAllLink.dataset.company  || "";
            var cLoc  = viewAllLink.dataset.location || "";
            if (viewEmpCompany)  viewEmpCompany.value  = cName;
            if (viewEmpLocation) viewEmpLocation.value = cLoc;
            if (viewEmployeesForm) viewEmployeesForm.submit();
            return;
        }

        var trigger = e.target.closest(".drawer-trigger");
        if (trigger) {
            var tr = trigger.closest("tr");
            if (tr) {
                var idStr = tr.id;
                if (idStr && idStr.indexOf("company-card-") === 0) {
                    var idx = idStr.replace("company-card-", "");
                    var tpl = document.getElementById("company-profile-" + idx);
                    if (tpl && companyDrawerContent) {
                        companyDrawerContent.innerHTML = tpl.innerHTML;

                        var dContent = companyDrawerContent.querySelector(".drawer-desc-content");
                        var dToggle  = companyDrawerContent.querySelector(".drawer-desc-toggle");
                        if (dContent && dToggle) {
                            if (dContent.scrollHeight <= dContent.clientHeight) {
                                dToggle.style.display = "none";
                            }
                        }

                        openDrawerRowIndex = idx;

                        var cbEl = tr.querySelector(".row-checkbox");
                        var companyName = cbEl ? (cbEl.dataset.name        || "") : "";
                        var companyHQ   = cbEl ? (cbEl.dataset.headquarter || "") : "";

                        if (viewEmpCompany)  viewEmpCompany.value  = companyName;
                        if (viewEmpLocation) viewEmpLocation.value = companyHQ;

                        openCompanyDrawer();
                    }
                }
            }
        }
    });

    // ── Init ──
    setTab("new");
    updateSelectionUI();
});