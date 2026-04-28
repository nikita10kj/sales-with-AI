document.addEventListener("DOMContentLoaded", function () {

    // ── Toast ──
    const customMessage = document.getElementById("customMessage");
    const customMessageText = document.getElementById("customMessageText");
    const closeCustomMessage = document.getElementById("closeCustomMessage");
    let customMessageTimeout;

    function showMessage(message, type = "success") {
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
            const parent = button.closest(".filter-item");
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
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + "=")) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // ── Tag input system ──
    const tagInputInstances = [];

    function setupTagInput(config) {
        const input = document.getElementById(config.inputId);
        const addBtn = document.getElementById(config.addBtnId);
        const tagsContainer = document.getElementById(config.tagsContainerId);
        const hiddenInput = document.getElementById(config.hiddenInputId);

        if (!input || !addBtn || !tagsContainer || !hiddenInput) return;

        let tags = [];

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
                const tag = document.createElement("div");
                tag.className = "tag";
                tag.innerHTML = `
                    <span class="tag-text">${escapeHtml(tagValue)}</span>
                    <span class="tag-remove" data-index="${index}">&times;</span>
                `;
                tagsContainer.appendChild(tag);
            });
            tagsContainer.querySelectorAll(".tag-remove").forEach(function (removeBtn) {
                removeBtn.addEventListener("click", function () {
                    const index = parseInt(removeBtn.getAttribute("data-index"), 10);
                    tags.splice(index, 1);
                    updateHiddenInput();
                    renderTags();
                });
            });
        }

        function addTag(value = null) {
            const finalValue = (value !== null ? value : input.value).trim();
            if (!finalValue) return;
            const alreadyExists = tags.some(function (tag) {
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
            const pendingValue = input.value.trim();
            if (pendingValue) addTag(pendingValue);
        }

        addBtn.addEventListener("click", function () { addTag(); });

        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                addTag();
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

    setupTagInput({ inputId: "companyInput",            addBtnId: "addCompanyTag",             tagsContainerId: "companyTags",             hiddenInputId: "companyHidden" });
    setupTagInput({ inputId: "industryInput",           addBtnId: "addIndustryTag",            tagsContainerId: "industryTags",            hiddenInputId: "industryHidden" });
    setupTagInput({ inputId: "companyLocationInput",    addBtnId: "addCompanyLocationTag",     tagsContainerId: "companyLocationTags",     hiddenInputId: "companyLocationHidden" });
    setupTagInput({ inputId: "companySpecialitesInput", addBtnId: "addCompanySpecialitesTag",  tagsContainerId: "companySpecialitesTags",  hiddenInputId: "companySpecialitesHidden" });
    setupTagInput({ inputId: "employeeCountInput",      addBtnId: "addEmployeeCountTag",       tagsContainerId: "employeeCountTags",       hiddenInputId: "employeeCountHidden" });
    setupTagInput({ inputId: "companyTechnologiesInput",addBtnId: "addCompanyTechnologiesTag", tagsContainerId: "companyTechnologiesTags", hiddenInputId: "companyTechnologiesHidden" });
    setupTagInput({ inputId: "jobPostsInput",           addBtnId: "addJobPostsTag",            tagsContainerId: "jobPostsTags",            hiddenInputId: "jobPostsHidden" });

    const companySearchForm = document.getElementById("companySearchForm");
    const searchLoader = document.getElementById("searchLoaderOverlay");

    function showSearchLoader() { if (searchLoader) searchLoader.style.display = "flex"; }
    function hideSearchLoader() { if (searchLoader) searchLoader.style.display = "none"; }

    function buildCompanyResultsHTML(companies) {
        if (!companies || !companies.length) {
            return '<div class="empty-box"><i class="fas fa-building"></i><p>No results found. Try different filters.</p></div>';
        }

        var html = '<div class="results-card">';

        // meta bar
        html += '<div class="results-meta"><div class="results-meta-left">'
            + '<input type="checkbox" id="selectAllRows">'
            + ' <i class="fas fa-chevron-down" style="font-size:11px;color:#aab0c4;cursor:pointer;"></i>'
            + ' <span id="selectedCountText">0 selected of ' + companies.length + ' results</span>'
            + '</div><div class="results-meta-right">'
            + '<button type="button" id="saveToListBtn" class="save-list-btn" style="display:none;"><i class="fas fa-plus"></i> Save to List</button>'
            + '<button type="button" class="save-unlock-btn"><i class="fas fa-lock"></i> Save To Unlock</button>'
            + '</div></div>';

        // table
        html += '<div class="table-wrap"><table class="results-table"><thead><tr>'
            + '<th class="col-chk"></th><th>Company</th><th>Description</th>'
            + '<th>HQ Location</th><th>Industry</th><th>Company Size</th><th>Actions</th>'
            + '</tr></thead><tbody>';

        companies.forEach(function (c, i) {
            var idx = i + 1;
            var initial = (c.name || "C").charAt(0);
            var avatarClass = c.logo_url ? 'company-avatar' : 'company-avatar fallback-avatar';

            html += '<tr id="company-card-' + idx + '">';

            // checkbox
            html += '<td class="col-chk"><input type="checkbox" class="row-checkbox"'
                + ' data-name="' + escapeHtml(c.name) + '"'
                + ' data-linkedin_url="' + escapeHtml(c.linkedin_url || "") + '"'
                + ' data-website="' + escapeHtml(c.website || "") + '"'
                + ' data-industry="' + escapeHtml(c.industry || "") + '"'
                + ' data-description="' + escapeHtml(c.description || "") + '"'
                + ' data-company_size="' + escapeHtml(c.company_size || "") + '"'
                + ' data-headquarter="' + escapeHtml(c.headquarter || "") + '"'
                + '></td>';

            // Company: avatar + name
            html += '<td class="drawer-trigger"><div class="profile-cell">';
            if (c.linkedin_url) html += '<a href="' + escapeHtml(c.linkedin_url) + '" target="_blank" class="avatar-link" title="View on LinkedIn">';
            html += '<div class="' + avatarClass + '">';
            if (c.logo_url) html += '<img src="' + escapeHtml(c.logo_url) + '" alt="Company Logo" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'fallback-avatar\');">';
            html += '<div class="avatar-placeholder"><span class="shape shape1"></span><span class="shape shape2"></span></div>';
            html += '</div>';
            if (c.linkedin_url) html += '</a>';
            html += '<div class="profile-info"><span class="profile-name drawer-trigger" data-tooltip="' + escapeHtml(c.name) + '">' + escapeHtml(c.name || "—") + '</span>';
            if (c.linkedin_url) html += '<a href="' + escapeHtml(c.linkedin_url) + '" target="_blank" class="li-badge" title="LinkedIn">in</a>';
            html += '</div></div></td>';

            // Description
            html += '<td class="cell-truncate cell-desc drawer-trigger">' + escapeHtml(c.description || "—") + '</td>';

            // HQ Location
            html += '<td class="cell-truncate drawer-trigger"' + (c.headquarter ? ' data-tooltip="' + escapeHtml(c.headquarter) + '"' : '') + '>';
            html += c.headquarter ? '<span class="cell-icon"><i class="fas fa-map-marker-alt"></i></span>' + escapeHtml(c.headquarter) : '—';
            html += '</td>';

            // Industry
            html += '<td class="cell-truncate drawer-trigger"' + (c.industry ? ' data-tooltip="' + escapeHtml(c.industry) + '"' : '') + '>';
            html += c.industry ? '<span class="cell-icon"><i class="fas fa-industry"></i></span>' + escapeHtml(c.industry) : '—';
            html += '</td>';

            // Company Size
            html += '<td class="cell-truncate"' + (c.company_size ? ' data-tooltip="' + escapeHtml(c.company_size) + ' employees"' : '') + '>';
            html += c.company_size ? '<span class="cell-icon"><i class="fas fa-users"></i></span>' + escapeHtml(c.company_size) : '—';
            html += '</td>';

            // Actions
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

        // pagination footer
        html += '<div class="results-footer"><div class="results-footer-left">'
            + '<span class="goto-label">Go to page</span>'
            + '<span class="goto-page-wrap"><i class="fas fa-info-circle"></i> <span>1</span> <i class="fas fa-chevron-down"></i></span>'
            + '</div><div class="pagination-wrap"><span class="results-count-text">1–' + companies.length + ' of ' + companies.length + '</span>'
            + '<button class="page-btn" type="button" title="Previous"><i class="fas fa-chevron-left"></i></button>'
            + '<button class="page-btn" type="button" title="Next"><i class="fas fa-chevron-right"></i></button>'
            + '</div></div>';

        html += '</div>';
        return html;
    }

    function buildCompanyProfilesHTML(companies) {
        var html = '';
        companies.forEach(function (c, i) {
            var idx = i + 1;
            var initial = (c.name || "C").charAt(0);

            html += '<div id="company-profile-' + idx + '" class="company-profile-tpl" style="display:none;" aria-hidden="true">';

            // Hero Card
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

            // Meta + Description
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
            html += '<div class="drawer-meta-item"><i class="fas fa-map-marker-alt"></i><span>' + escapeHtml(c.location_country || c.headquarter || "—") + '</span></div>';
            if (c.linkedin_url) html += '<a href="' + escapeHtml(c.linkedin_url) + '" target="_blank" style="color:#2f6df0;font-size:12.5px;font-weight:600;text-decoration:none;">View Company Profile</a>';
            html += '</div>';

            if (c.description) {
                html += '<div style="background:#f4f5fb;border-radius:10px;border:1px solid #e8ebf2;padding:12px 14px;">';
                html += '<div style="font-size:13px;color:#4c556f;line-height:1.6;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;line-clamp:3;-webkit-box-orient:vertical;" class="drawer-desc-content">' + escapeHtml(c.description) + '</div>';
                html += '<button type="button" class="drawer-desc-toggle" style="border:none;background:none;color:#6a7388;font-size:13px;font-weight:500;cursor:pointer;padding:0;margin-top:8px;display:inline-flex;align-items:center;gap:6px;font-family:\'Inter\',sans-serif;"><i class="fas fa-chevron-down" style="font-size:10px;transition:transform 0.2s;"></i> <span class="toggle-text">Read More</span></button>';
                html += '</div>';
            }
            html += '</div></div>';

            // Basic Details
            html += '<div style="background:#fff;border-top:1px solid #e8ebf2;border-bottom:1px solid #e8ebf2;margin-bottom:16px;">';
            html += '<div class="drawer-section" style="border-bottom:none;">';
            html += '<div style="font-size:16px;font-weight:700;color:#1a2038;margin-bottom:16px;">Basic Details</div>';
            html += '<div style="display:grid;grid-template-columns:140px 1fr;gap:12px;font-size:13px;color:#4c556f;">';

            var details = [
                {icon: "far fa-user", label: "Company Size", value: c.company_size || "—"},
                {icon: "fas fa-map-marker-alt", label: "HQ Location", value: c.headquarter || "—"},
                {icon: "far fa-building", label: "Industry", value: c.industry || "—"},
            ];
            details.forEach(function(d) {
                html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="' + d.icon + '" style="width:14px;text-align:center;"></i> ' + d.label + '</div>';
                html += '<div style="color:#1a2038;">' + escapeHtml(d.value) + '</div>';
            });

            // Website
            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-link" style="width:14px;text-align:center;"></i> Website</div>';
            if (c.website) html += '<div style="color:#1a2038;"><a href="' + escapeHtml(c.website) + '" target="_blank" style="color:#2f6df0;text-decoration:none;">' + escapeHtml(c.website) + '</a></div>';
            else html += '<div style="color:#1a2038;">—</div>';

            // Founded, Specialties, Tagline, Revenue, Followers
            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-history" style="width:14px;text-align:center;"></i> Founded at</div>';
            html += '<div style="color:#1a2038;">' + escapeHtml(c.found_at || "—") + '</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-hashtag" style="width:14px;text-align:center;"></i> Specialities</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
            if (c.specialties && c.specialties.length) {
                c.specialties.forEach(function(sp) { html += '<span style="background:#f0f3ff;color:#4c556f;padding:3px 8px;border-radius:6px;font-size:12px;">' + escapeHtml(sp) + '</span>'; });
            } else html += '—';
            html += '</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="far fa-compass" style="width:14px;text-align:center;"></i> Tagline</div>';
            html += '<div style="color:#1a2038;">' + escapeHtml(c.tagline || "—") + '</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-chart-line" style="width:14px;text-align:center;"></i> Revenue</div>';
            html += '<div style="color:#1a2038;">' + escapeHtml(c.revenue || "—") + '</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;color:#6a7388;"><i class="fas fa-users" style="width:14px;text-align:center;"></i> LinkedIn Followers</div>';
            html += '<div style="color:#1a2038;">' + escapeHtml(c.linkedin_followers || "—") + '</div>';

            html += '</div></div></div>';

            // Decision Makers
            html += '<div style="background:#fff;border-top:1px solid #e8ebf2;border-bottom:1px solid #e8ebf2;margin-bottom:16px;">';
            html += '<div class="drawer-section" style="border-bottom:none;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
            html += '<div style="font-size:16px;font-weight:700;color:#1a2038;">Potential Decision Makers</div>';
            html += '<a href="#" class="drawer-view-employees-link" data-company="' + escapeHtml(c.name) + '" data-location="' + escapeHtml(c.location_country || c.headquarter || "") + '" style="color:#2f6df0;font-size:12.5px;font-weight:600;text-decoration:none;">View All Employees</a>';
            html += '</div>';

            if (c.decision_makers && c.decision_makers.length) {
                html += '<div style="border:1px solid #e8ebf2;border-radius:10px;background:#fff;overflow:hidden;">';
                c.decision_makers.forEach(function(dm) {
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

        // Clear old results and profiles
        resultsContent.innerHTML = "";
        document.querySelectorAll(".company-profile-tpl").forEach(function(el) { el.remove(); });

        if (data.error && (!data.companies || !data.companies.length)) {
            resultsContent.innerHTML = '<div class="error-box"><i class="fas fa-exclamation-circle"></i> ' + escapeHtml(data.error) + '</div>';
            return;
        }

        if (!data.companies || !data.companies.length) {
            resultsContent.innerHTML = '<div class="empty-box"><i class="fas fa-building"></i><p>No results yet. Use the filters on the left and hit <strong>Search</strong>.</p></div>';
            return;
        }

        resultsContent.innerHTML = buildCompanyResultsHTML(data.companies);

        // Insert profile templates after results-panel
        var resultsPanel = document.querySelector(".results-panel");
        if (resultsPanel) resultsPanel.insertAdjacentHTML("afterend", buildCompanyProfilesHTML(data.companies));

        // Update credit pills
        if (typeof slUpdateSearchPill === "function" && typeof data.search_credits === "number") slUpdateSearchPill(data.search_credits);
        if (typeof slUpdatePill === "function" && typeof data.credits === "number") slUpdatePill(data.credits);

        // Re-attach selection events
        reattachCompanySelectionEvents();
    }

    function reattachCompanySelectionEvents() {
        var cbs = document.querySelectorAll(".row-checkbox");
        var sa = document.getElementById("selectAllRows");
        var st = document.getElementById("selectedCountText");
        var sb = document.getElementById("saveToListBtn");

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
        if (sb) sb.addEventListener("click", async function () {
            await loadExistingLists();
            setTab("new");
            openModal();
        });

        var cp = document.getElementById("contactPill");
        if (cp) cp.textContent = "0/" + cbs.length;
    }

    if (companySearchForm) {
        companySearchForm.addEventListener("submit", function (e) {
            e.preventDefault();

            // Finalize pending tag inputs
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

    // ── Selection & Save to List ──
    const rowCheckboxes = document.querySelectorAll(".row-checkbox");
    const selectAllRows = document.getElementById("selectAllRows");
    const selectedCountText = document.getElementById("selectedCountText");
    const saveToListBtn = document.getElementById("saveToListBtn");

    const saveListModal = document.getElementById("saveListModal");
    const closeSaveListModal = document.getElementById("closeSaveListModal");
    const cancelSaveListBtn = document.getElementById("cancelSaveListBtn");
    const confirmSaveListBtn = document.getElementById("confirmSaveListBtn");

    const newListTab = document.getElementById("newListTab");
    const existingListTab = document.getElementById("existingListTab");
    const newListSection = document.getElementById("newListSection");
    const existingListSection = document.getElementById("existingListSection");
    const newListName = document.getElementById("newListName");
    const existingListSelect = document.getElementById("existingListSelect");

    let activeListMode = "new";

    function updateSelectionUI() {
        if (!selectedCountText || !saveToListBtn) return;
        const checkedCount = document.querySelectorAll(".row-checkbox:checked").length;
        const totalCount = rowCheckboxes.length;
        selectedCountText.textContent = `${checkedCount} selected of ${totalCount} results`;
        saveToListBtn.style.display = checkedCount > 0 ? "inline-flex" : "none";
        if (selectAllRows) {
            selectAllRows.checked = totalCount > 0 && checkedCount === totalCount;
        }
    }

    function collectSelectedCompanies() {
        const selected = [];
        document.querySelectorAll(".row-checkbox:checked").forEach(function (cb) {
            selected.push({
                name:          cb.dataset.name           || "",
                linkedin_url:  cb.dataset.linkedin_url   || "",
                website:       cb.dataset.website        || "",
                industry:      cb.dataset.industry       || "",
                domain:        cb.dataset.domain         || "",
                revenue:       cb.dataset.revenue        || "",
                specialties:   cb.dataset.specialties    || "",
                headquarter:   cb.dataset.headquarter    || "",
                location:      cb.dataset.location       || "",
                company_market:cb.dataset.company_market || ""
            });
        });
        return selected;
    }

    async function loadExistingLists() {
        if (!existingListSelect) return;
        try {
            const response = await fetch(GET_SAVED_LISTS_URL, {
                method: "GET",
                headers: { "X-Requested-With": "XMLHttpRequest" }
            });
            const data = await response.json();
            existingListSelect.innerHTML = '<option value="">Select a list</option>';
            if (data.success && Array.isArray(data.lists)) {
                data.lists.forEach(function (item) {
                    const option = document.createElement("option");
                    option.value = item.id;
                    option.textContent = item.name;
                    existingListSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Failed to load existing lists:", error);
        }
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
        saveToListBtn.addEventListener("click", async function () {
            await loadExistingLists();
            setTab("new");
            openModal();
        });
    }

    if (closeSaveListModal) closeSaveListModal.addEventListener("click", closeModal);
    if (cancelSaveListBtn) cancelSaveListBtn.addEventListener("click", closeModal);

    if (newListTab) {
        newListTab.addEventListener("click", function () { setTab("new"); });
    }
    if (existingListTab) {
        existingListTab.addEventListener("click", async function () {
            setTab("existing");
            await loadExistingLists();
        });
    }

    if (confirmSaveListBtn) {
        confirmSaveListBtn.addEventListener("click", async function () {
            const selectedCompanies = collectSelectedCompanies();
            if (!selectedCompanies.length) {
                showMessage("Please select at least one company.", "error");
                return;
            }

            const payload = { list_type: activeListMode, companies: selectedCompanies };

            if (activeListMode === "new") {
                const listName = newListName ? newListName.value.trim() : "";
                if (!listName) { showMessage("Please enter a list name.", "error"); return; }
                payload.list_name = listName;
            } else {
                const listId = existingListSelect ? existingListSelect.value : "";
                if (!listId) { showMessage("Please select an existing list.", "error"); return; }
                payload.list_id = listId;
            }

            try {
                confirmSaveListBtn.disabled = true;
                confirmSaveListBtn.textContent = "Saving...";

                const response = await fetch(SAVE_COMPANIES_TO_LIST_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (!data.success) {
                    showMessage(data.error || "Could not save list.", "error");
                    return;
                }
                showMessage(data.message || "Saved successfully.", "success");
                closeModal();
            } catch (error) {
                console.error("Save list error:", error);
                showMessage("Server error while saving list.", "error");
            } finally {
                confirmSaveListBtn.disabled = false;
                confirmSaveListBtn.textContent = "Save to List";
            }
        });
    }

    // ── Single row Save to List button ──
    document.addEventListener("click", function (e) {
        const singleSaveBtn = e.target.closest(".single-save-btn");
        if (singleSaveBtn) {
            document.querySelectorAll(".row-checkbox").forEach(cb => cb.checked = false);
            const selectAll = document.getElementById("selectAllRows");
            if (selectAll) selectAll.checked = false;

            const row = singleSaveBtn.closest("tr");
            if (row) {
                const cb = row.querySelector(".row-checkbox");
                if (cb) cb.checked = true;
            }

            updateSelectionUI();
            const listBtn = document.getElementById("saveToListBtn");
            if (listBtn) listBtn.click();
        }
    });

    // ── Global Tooltip ──
    const tooltipEl = document.createElement("div");
    tooltipEl.className = "global-custom-tooltip";
    document.body.appendChild(tooltipEl);

    document.addEventListener("mouseover", function (e) {
        const target = e.target.closest("[data-tooltip]");
        if (!target) return;
        const text = target.getAttribute("data-tooltip");
        if (!text) return;
        tooltipEl.textContent = text;
        tooltipEl.classList.add("visible");
        const rect = target.getBoundingClientRect();
        let top = rect.bottom + window.scrollY + 6;
        let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipEl.offsetWidth / 2);
        if (left < 10) left = 10;
        if (left + tooltipEl.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltipEl.offsetWidth - 10;
        }
        tooltipEl.style.top = top + "px";
        tooltipEl.style.left = left + "px";
    });

    document.addEventListener("mouseout", function (e) {
        if (e.target.closest("[data-tooltip]")) {
            tooltipEl.classList.remove("visible");
        }
    });

    window.addEventListener("scroll", () => tooltipEl.classList.remove("visible"));

    // ── Mobile Filter Toggle ──
    const mobileFilterBtn = document.getElementById("mobileFilterBtn");
    const filtersPanel = document.querySelector(".filters-panel");
    const overlay = document.createElement("div");
    overlay.className = "mobile-filter-overlay";
    document.body.appendChild(overlay);

if (mobileFilterBtn) {
    if (window.innerWidth <= 860) {
        mobileFilterBtn.style.display = "inline-flex";
    } else {
        mobileFilterBtn.style.display = "none";
    }
}

window.addEventListener("resize", function() {
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
        filtersPanel.style.setProperty("position", "fixed", "important");
        filtersPanel.style.setProperty("left", "0", "important");
        filtersPanel.style.setProperty("top", "0", "important");
        filtersPanel.style.setProperty("width", "300px", "important");
        filtersPanel.style.setProperty("height", "100vh", "important");
        filtersPanel.style.setProperty("min-height", "100vh", "important");
        filtersPanel.style.setProperty("overflow-y", "auto", "important");
        filtersPanel.style.setProperty("padding", "0.75rem", "important");
        filtersPanel.style.setProperty("z-index", "9500", "important");
        filtersPanel.style.setProperty("max-height", "none", "important");
        filtersPanel.style.setProperty("background", "#fff", "important");
        mobileFilterBtn.innerHTML = '<i class="fas fa-times"></i> Close';
        mobileFilterBtn.classList.add("active");
        overlay.classList.add("show");
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
        overlay.classList.remove("show");
        document.body.style.overflow = "";
    }

    mobileFilterBtn.addEventListener("click", function() {
        if (filterOpen) { closeFilter(); } else { openFilter(); }
    });

    overlay.addEventListener("click", function() {
        closeFilter();
    });
}

    // ── Profile Drawer Logic ──
    const companyDrawer = document.getElementById("companyDrawer");
    const companyDrawerOverlay = document.getElementById("companyDrawerOverlay");
    const closeCompanyDrawer = document.getElementById("closeCompanyDrawer");
    const companyDrawerContent = document.getElementById("companyDrawerContent");
    const drawerViewEmployeesBtn = document.getElementById("drawerViewEmployeesBtn");
    const drawerSaveToListBtn = document.getElementById("drawerSaveToListBtn");
    const viewEmployeesForm = document.getElementById("viewEmployeesForm");
    const viewEmpCompany = document.getElementById("viewEmpCompany");
    const viewEmpLocation = document.getElementById("viewEmpLocation");

    // Track which table row index the open drawer belongs to (1-based)
    let openDrawerRowIndex = null;

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

    if (closeCompanyDrawer) {
        closeCompanyDrawer.addEventListener("click", closeCompanyDrawerFn);
    }
    if (companyDrawerOverlay) {
        companyDrawerOverlay.addEventListener("click", closeCompanyDrawerFn);
    }

    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && companyDrawer && companyDrawer.classList.contains("open")) {
            closeCompanyDrawerFn();
        }
    });

    // ── View Employees: submit hidden form to search_people ──
    if (drawerViewEmployeesBtn) {
        drawerViewEmployeesBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (viewEmployeesForm) {
                viewEmployeesForm.submit();
            }
        });
    }

    // ── Drawer Save to List: select row & open modal ──
    if (drawerSaveToListBtn) {
        drawerSaveToListBtn.addEventListener("click", async function () {
            if (openDrawerRowIndex !== null) {
                // Deselect all rows first
                document.querySelectorAll(".row-checkbox").forEach(cb => cb.checked = false);
                const selectAll = document.getElementById("selectAllRows");
                if (selectAll) selectAll.checked = false;

                // Select the row that matches the open drawer
                const row = document.getElementById("company-card-" + openDrawerRowIndex);
                if (row) {
                    const cb = row.querySelector(".row-checkbox");
                    if (cb) cb.checked = true;
                }

                updateSelectionUI();
            }
            await loadExistingLists();
            setTab("new");
            openModal();
        });
    }

    document.addEventListener("click", function (e) {
        const descToggle = e.target.closest(".drawer-desc-toggle");
        if (descToggle) {
            const descContent = descToggle.previousElementSibling;
            if (descContent) {
                const icon = descToggle.querySelector("i");
                const text = descToggle.querySelector(".toggle-text");
                const isExpanded = (descContent.style.webkitLineClamp === "unset");
                
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

        // ── Handle "View All Employees" link inside drawer content ──
        const viewAllLink = e.target.closest(".drawer-view-employees-link");
        if (viewAllLink) {
            e.preventDefault();
            const cName = viewAllLink.dataset.company || "";
            const cLoc  = viewAllLink.dataset.location || "";
            if (viewEmpCompany) viewEmpCompany.value = cName;
            if (viewEmpLocation) viewEmpLocation.value = cLoc;
            if (viewEmployeesForm) viewEmployeesForm.submit();
            return;
        }

        const trigger = e.target.closest(".drawer-trigger");
        if (trigger) {
            const tr = trigger.closest("tr");
            if (tr) {
                const idStr = tr.id; // e.g. company-card-1
                if (idStr && idStr.startsWith("company-card-")) {
                    const idx = idStr.replace("company-card-", "");
                    const tpl = document.getElementById("company-profile-" + idx);
                    if (tpl && companyDrawerContent) {
                        companyDrawerContent.innerHTML = tpl.innerHTML;
                        
                        // Check if description actually overflows 3 lines
                        const dContent = companyDrawerContent.querySelector(".drawer-desc-content");
                        const dToggle = companyDrawerContent.querySelector(".drawer-desc-toggle");
                        if (dContent && dToggle) {
                            if (dContent.scrollHeight <= dContent.clientHeight) {
                                dToggle.style.display = "none";
                            }
                        }

                        // Store row index for Save to List
                        openDrawerRowIndex = idx;

                        // Update "View Employees" button with company name & location
                        // Pull data from the row's checkbox dataset
                        const cb = tr.querySelector(".row-checkbox");
                        const companyName = cb ? (cb.dataset.name || "") : "";
                        const companyHQ   = cb ? (cb.dataset.headquarter || "") : "";

                        if (viewEmpCompany) viewEmpCompany.value = companyName;
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