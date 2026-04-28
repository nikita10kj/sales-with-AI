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

    // ── Enrich loader ──
    const loader = document.getElementById("enrichLoader");

    // ── Show loader on form submit ──
    const searchForm = document.getElementById("linkedinSearchForm");

    function showLoader() { if (loader) loader.style.display = "flex"; }
    function hideLoader() { if (loader) loader.style.display = "none"; }

    function buildResultsHTML(people) {
        if (!people || !people.length) {
            return '<div class="error-box"><i class="fas fa-info-circle"></i> No results found for this LinkedIn URL.</div>';
        }

        var html = '<div class="results-card">';

        // meta bar
        html += '<div class="results-meta"><div class="results-meta-left">'
            + '<input type="checkbox" id="selectAllRows">'
            + ' <i class="fas fa-chevron-down" style="font-size:11px;color:#aab0c4;cursor:pointer;"></i>'
            + ' <span id="selectedCountText">0 selected of ' + people.length + ' results</span>'
            + '</div><div class="results-meta-right">'
            + '<button type="button" id="saveToListBtn" class="save-list-btn" style="display:none;"><i class="fas fa-plus"></i> Save to List</button>'
            + '</div></div>';

        // table
        html += '<div class="table-wrap"><table class="results-table"><thead><tr>'
            + '<th class="col-chk"></th><th>Profile</th><th>Job Title</th>'
            + '<th>Contact Location</th><th>Company</th><th>HQ Location</th>'
            + '<th>Institution</th><th>LinkedIn URL</th><th>Email</th><th>Contact</th><th>Actions</th>'
            + '</tr></thead><tbody>';

        people.forEach(function (p, i) {
            var idx = i + 1;
            var initials = ((p.first || "U").charAt(0) + (p.last || "").charAt(0));

            html += '<tr id="person-card-' + idx + '">';

            // checkbox
            html += '<td class="col-chk"><input type="checkbox" class="row-checkbox"'
                + ' data-first="' + escapeHtml(p.first) + '"'
                + ' data-last="' + escapeHtml(p.last) + '"'
                + ' data-linkedin="' + escapeHtml(p.linkedin) + '"'
                + ' data-company="' + escapeHtml(p.company) + '"'
                + ' data-company_website="' + escapeHtml(p.company_website || "") + '"'
                + ' data-job_title="' + escapeHtml(p.job_title) + '"'
                + ' data-institution="' + escapeHtml(p.institution) + '"'
                + ' data-location="' + escapeHtml(p.location) + '"'
                + ' data-company_headquarter="' + escapeHtml(p.company_headquarter) + '"'
                + ' data-email="' + escapeHtml(p.emails && p.emails[0] ? (p.emails[0].email || "") : "") + '"'
                + ' data-phone="' + escapeHtml(p.phones && p.phones[0] ? (p.phones[0].number || "") : "") + '"'
                + '></td>';

            // profile
            var photoHtml = p.photo
                ? '<img src="' + escapeHtml(p.photo) + '" alt="Profile Photo" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'fallback-avatar\');">'
                : '';
            var avatarClass = p.photo ? 'avatar-circle' : 'avatar-circle fallback-avatar';
            html += '<td><div class="profile-cell">';
            if (p.linkedin) html += '<a href="' + escapeHtml(p.linkedin) + '" target="_blank" class="avatar-link">';
            html += '<div class="' + avatarClass + '">' + photoHtml + '<span class="initials">' + escapeHtml(initials) + '</span></div>';
            if (p.linkedin) html += '</a>';
            html += '<div class="profile-info"><span class="profile-name drawer-trigger" data-tooltip="' + escapeHtml(p.first + ' ' + p.last) + '">' + escapeHtml(p.first + ' ' + p.last) + '</span>';
            if (p.linkedin) html += ' <a href="' + escapeHtml(p.linkedin) + '" target="_blank" class="li-badge" title="LinkedIn">in</a>';
            html += '</div></div></td>';

            // job title, location, company, HQ, institution, LinkedIn URL
            html += '<td class="cell-truncate drawer-trigger" data-tooltip="' + escapeHtml(p.job_title || '') + '">' + escapeHtml(p.job_title || "—") + '</td>';

            html += '<td class="cell-truncate drawer-trigger"' + (p.location ? ' data-tooltip="' + escapeHtml(p.location) + '"' : '') + '>';
            html += p.location ? '<span class="cell-icon"><i class="fas fa-map-marker-alt"></i></span>' + escapeHtml(p.location) : '—';
            html += '</td>';

            html += '<td class="cell-truncate"' + (p.company ? ' data-tooltip="' + escapeHtml(p.company) + '"' : '') + '>';
            if (p.company) {
                if (p.company_website) html += '<a href="' + escapeHtml(p.company_website) + '" target="_blank" class="company-link">';
                html += '<span class="cell-icon"><i class="fas fa-building"></i></span>' + escapeHtml(p.company);
                if (p.company_website) html += '</a>';
            } else html += '—';
            html += '</td>';

            html += '<td class="cell-truncate drawer-trigger"' + (p.company_headquarter ? ' data-tooltip="' + escapeHtml(p.company_headquarter) + '"' : '') + '>';
            html += p.company_headquarter ? '<span class="cell-icon"><i class="fas fa-map-marker-alt"></i></span>' + escapeHtml(p.company_headquarter) : '—';
            html += '</td>';

            html += '<td class="cell-truncate"' + (p.institution ? ' data-tooltip="' + escapeHtml(p.institution) + '"' : '') + '>';
            html += p.institution ? '<span class="cell-icon"><i class="fas fa-graduation-cap"></i></span>' + escapeHtml(p.institution) : '—';
            html += '</td>';

            html += '<td class="cell-truncate"' + (p.linkedin ? ' data-tooltip="' + escapeHtml(p.linkedin) + '"' : '') + '>';
            html += p.linkedin ? '<a href="' + escapeHtml(p.linkedin) + '" target="_blank" class="linkedin-url-link"><i class="fab fa-linkedin" style="color:#0a66c2;margin-right:5px;"></i>View Profile</a>' : '—';
            html += '</td>';

            // Email
            var hasEmail = p.emails && p.emails[0] && p.emails[0].email;
            html += '<td class="email-col-' + idx + '" style="min-width:180px;">';
            if (hasEmail) html += '<span class="contact-col-pill contact-col-email"><i class="far fa-envelope me-1"></i>' + escapeHtml(p.emails[0].email) + '</span>';
            else html += '<span class="contact-col-blurred">***@*****</span>';
            html += '</td>';

            // Phone
            var hasPhone = p.phones && p.phones[0] && p.phones[0].number;
            html += '<td class="phone-col-' + idx + '" style="min-width:130px;">';
            if (hasPhone) html += '<span class="contact-col-pill contact-col-phone"><i class="fas fa-phone-alt me-1" style="font-size:10px;"></i>' + escapeHtml(p.phones[0].number) + '</span>';
            else html += '<span class="contact-col-blurred">***-****</span>';
            html += '</td>';

            // Actions
            html += '<td style="min-width:150px;"><div class="action-icons">';
            if (hasEmail) {
                html += '<form method="POST" action="' + SELECT_PERSON_FOR_EMAIL_URL + '" class="d-inline">'
                    + '<input type="hidden" name="csrfmiddlewaretoken" value="' + CSRF_TOKEN + '">'
                    + '<input type="hidden" name="first" value="' + escapeHtml(p.first) + '">'
                    + '<input type="hidden" name="last" value="' + escapeHtml(p.last) + '">'
                    + '<input type="hidden" name="linkedin" value="' + escapeHtml(p.linkedin) + '">'
                    + '<input type="hidden" name="company" value="' + escapeHtml(p.company) + '">'
                    + '<input type="hidden" name="company_website" value="' + escapeHtml(p.company_website || "") + '">'
                    + '<input type="hidden" name="job_title" value="' + escapeHtml(p.job_title) + '">'
                    + '<input type="hidden" name="institution" value="' + escapeHtml(p.institution) + '">'
                    + '<input type="hidden" name="location" value="' + escapeHtml(p.location) + '">'
                    + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(p.company_headquarter) + '">'
                    + '<input type="hidden" name="email" value="' + escapeHtml(p.emails[0].email) + '">'
                    + '<button type="submit" class="send-email-col-btn" title="Send Email"><i class="far fa-envelope me-1"></i> Send Email</button></form>';
            } else {
                html += '<form method="POST" action="' + ENRICH_PERSON_URL + '" class="enrich-form d-inline">'
                    + '<input type="hidden" name="csrfmiddlewaretoken" value="' + CSRF_TOKEN + '">'
                    + '<input type="hidden" name="linkedin_url" value="' + escapeHtml(p.linkedin) + '">'
                    + '<input type="hidden" name="first" value="' + escapeHtml(p.first) + '">'
                    + '<input type="hidden" name="last" value="' + escapeHtml(p.last) + '">'
                    + '<input type="hidden" name="company" value="' + escapeHtml(p.company) + '">'
                    + '<input type="hidden" name="company_website" value="' + escapeHtml(p.company_website || "") + '">'
                    + '<input type="hidden" name="job_title" value="' + escapeHtml(p.job_title) + '">'
                    + '<input type="hidden" name="institution" value="' + escapeHtml(p.institution) + '">'
                    + '<input type="hidden" name="location" value="' + escapeHtml(p.location) + '">'
                    + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(p.company_headquarter) + '">'
                    + '<input type="hidden" name="card_id" value="' + idx + '">'
                    + '<input type="hidden" name="enrich_type" value="email">'
                    + '<button type="submit" title="Fetch Email"><i class="far fa-envelope"></i></button></form>';
            }
            html += '<form method="POST" action="' + ENRICH_PERSON_URL + '" class="enrich-form d-inline">'
                + '<input type="hidden" name="csrfmiddlewaretoken" value="' + CSRF_TOKEN + '">'
                + '<input type="hidden" name="linkedin_url" value="' + escapeHtml(p.linkedin) + '">'
                + '<input type="hidden" name="first" value="' + escapeHtml(p.first) + '">'
                + '<input type="hidden" name="last" value="' + escapeHtml(p.last) + '">'
                + '<input type="hidden" name="company" value="' + escapeHtml(p.company) + '">'
                + '<input type="hidden" name="company_website" value="' + escapeHtml(p.company_website || "") + '">'
                + '<input type="hidden" name="job_title" value="' + escapeHtml(p.job_title) + '">'
                + '<input type="hidden" name="institution" value="' + escapeHtml(p.institution) + '">'
                + '<input type="hidden" name="location" value="' + escapeHtml(p.location) + '">'
                + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(p.company_headquarter) + '">'
                + '<input type="hidden" name="card_id" value="' + idx + '">'
                + '<input type="hidden" name="enrich_type" value="phone">'
                + '<button type="submit" title="Fetch Phone"><i class="fas fa-phone-alt"></i></button></form>';

            html += '<button type="button" title="Save to List" class="single-save-btn"><i class="far fa-bookmark"></i></button>';
            html += '</div></td>';
            html += '</tr>';
            html += '<tr class="person-extra-row" id="person-extra-' + idx + '" style="display:none;"><td colspan="11" style="background:#fafbfe;padding:0;"><div class="person-extra-box" style="padding:16px 18px;"><div class="person-extra-content"></div></div></td></tr>';
        });

        html += '</tbody></table></div>';

        // pagination footer (simplified for LinkedIn — single page)
        html += '<div class="results-footer"><div class="results-footer-left">'
            + '<span class="goto-label">Go to page</span>'
            + '<span class="goto-page-wrap"><i class="fas fa-info-circle"></i> <span>1</span> <i class="fas fa-chevron-down"></i></span>'
            + '</div><div class="pagination-wrap"><span class="results-count-text">Page 1</span></div></div>';

        html += '</div>';
        return html;
    }

    function buildProfileTemplatesHTML(people) {
        var html = '';
        people.forEach(function (p, i) {
            var idx = i + 1;
            var initials = ((p.first || "U").charAt(0) + (p.last || "").charAt(0));

            html += '<div id="person-profile-' + idx + '" class="person-profile-tpl" style="display:none;" aria-hidden="true">';

            // Hero
            html += '<div class="drawer-hero"><div class="drawer-hero-top"><div class="drawer-avatar">';
            if (p.photo) {
                html += '<img src="' + escapeHtml(p.photo) + '" alt="' + escapeHtml(p.first + ' ' + p.last) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">';
                html += '<span class="drawer-avatar-initials" style="display:none;">' + escapeHtml(initials) + '</span>';
            } else {
                html += '<span class="drawer-avatar-initials">' + escapeHtml(initials) + '</span>';
            }
            html += '</div><div class="drawer-name-block"><div class="drawer-name">';
            if (p.linkedin) {
                html += '<a href="' + escapeHtml(p.linkedin) + '" target="_blank" style="color:inherit;text-decoration:none;">' + escapeHtml(p.first + ' ' + p.last) + '</a>';
                html += ' <a href="' + escapeHtml(p.linkedin) + '" target="_blank" class="li-badge" title="LinkedIn">in</a>';
            } else html += escapeHtml(p.first + ' ' + p.last);
            html += '</div>';
            if (p.job_title) html += '<div class="drawer-job">' + escapeHtml(p.job_title) + '</div>';
            html += '</div></div>';

            // Meta + Tags
            html += '<div class="drawer-meta-row">';
            if (p.location) html += '<div class="drawer-meta-item"><i class="fas fa-map-marker-alt"></i><span>' + escapeHtml(p.location) + '</span></div>';
            if (p.company_headquarter) html += '<div class="drawer-meta-item"><i class="fas fa-map-pin"></i><span>' + escapeHtml(p.company_headquarter) + '</span></div>';
            html += '</div><div class="drawer-tag-row">';
            if (p.company) html += '<span class="drawer-tag"><i class="fas fa-building"></i>' + escapeHtml(p.company) + '</span>';
            if (p.institution) html += '<span class="drawer-tag"><i class="fas fa-graduation-cap"></i>' + escapeHtml(p.institution) + '</span>';
            if (p.linkedin) html += '<a href="' + escapeHtml(p.linkedin) + '" target="_blank" class="drawer-tag li-tag" style="text-decoration:none;"><i class="fab fa-linkedin-in"></i>LinkedIn</a>';
            html += '</div></div>';

            // Contacts
            var hasEmail = p.emails && p.emails[0] && p.emails[0].email;
            var hasPhone = p.phones && p.phones[0] && p.phones[0].number;
            html += '<div class="drawer-section"><div class="drawer-section-title">Contacts</div>';
            html += '<div class="drawer-contact-row"><div class="drawer-contact-left"><i class="far fa-envelope"></i>';
            if (hasEmail) html += '<span class="contact-val">' + escapeHtml(p.emails[0].email) + '</span>';
            else html += '<span class="contact-blurred">***@***</span><button class="drawer-unlock-link" type="button">Enrich email</button>';
            html += '</div></div>';
            html += '<div class="drawer-contact-row"><div class="drawer-contact-left"><i class="fas fa-phone-alt" style="font-size:12px;margin-left:1px;"></i>';
            if (hasPhone) html += '<span class="contact-val">' + escapeHtml(p.phones[0].number) + '</span>';
            else html += '<span class="contact-blurred">**-***-***</span><button class="drawer-unlock-link" type="button">Enrich Contact</button>';
            html += '</div></div></div>';

            // Experience
            html += '<div class="drawer-section"><div class="drawer-section-title">Work Experience</div>';
            var exps = p.experience || [];
            if (exps.length) {
                exps.forEach(function(exp) {
                    html += '<div class="drawer-exp-item"><div class="drawer-exp-icon"><i class="fas fa-building"></i></div><div class="drawer-exp-body">';
                    html += '<div class="drawer-exp-title">' + escapeHtml(exp.title || "") + '</div>';
                    html += '<div class="drawer-exp-company">' + escapeHtml(exp.company || "") + (exp.location ? ' | ' + escapeHtml(exp.location) : '') + '</div>';
                    html += '</div></div>';
                });
            } else html += '<div class="drawer-no-data">No work experience available</div>';
            html += '</div>';

            // Skills
            html += '<div class="drawer-section"><div class="drawer-section-title">Skills</div>';
            var skills = p.skills_list || [];
            if (skills.length) {
                html += '<div class="drawer-skills-wrap">';
                skills.forEach(function(s) { html += '<span class="drawer-skill-chip">' + escapeHtml(s) + '</span>'; });
                html += '</div>';
            } else html += '<div class="drawer-no-data">No skills available</div>';
            html += '</div>';

            // Actions
            html += '<div class="drawer-actions">';
            if (hasEmail) {
                html += '<form method="POST" action="' + SELECT_PERSON_FOR_EMAIL_URL + '" class="d-inline" style="flex:1;">'
                    + '<input type="hidden" name="csrfmiddlewaretoken" value="' + CSRF_TOKEN + '">'
                    + '<input type="hidden" name="first" value="' + escapeHtml(p.first) + '">'
                    + '<input type="hidden" name="last" value="' + escapeHtml(p.last) + '">'
                    + '<input type="hidden" name="linkedin" value="' + escapeHtml(p.linkedin) + '">'
                    + '<input type="hidden" name="company" value="' + escapeHtml(p.company) + '">'
                    + '<input type="hidden" name="company_website" value="' + escapeHtml(p.company_website || "") + '">'
                    + '<input type="hidden" name="job_title" value="' + escapeHtml(p.job_title) + '">'
                    + '<input type="hidden" name="institution" value="' + escapeHtml(p.institution) + '">'
                    + '<input type="hidden" name="location" value="' + escapeHtml(p.location) + '">'
                    + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(p.company_headquarter) + '">'
                    + '<input type="hidden" name="email" value="' + escapeHtml(p.emails[0].email) + '">'
                    + '<button type="submit" class="drawer-action-btn primary" style="width:100%;"><i class="far fa-envelope"></i> Send Email</button></form>';
            } else {
                html += '<button class="drawer-action-btn primary" type="button" disabled style="flex:1;opacity:.5;cursor:not-allowed;"><i class="far fa-envelope"></i> Send Email</button>';
            }
            if (p.linkedin) html += '<a href="' + escapeHtml(p.linkedin) + '" target="_blank" class="drawer-action-btn secondary" style="flex:1;"><i class="fab fa-linkedin-in"></i> LinkedIn</a>';
            html += '</div></div>';
        });
        return html;
    }

    function renderAjaxResults(data) {
        var resultsContent = document.querySelector(".results-content");
        if (!resultsContent) return;

        // Clear old results
        resultsContent.innerHTML = "";
        document.querySelectorAll(".person-profile-tpl").forEach(function(el) { el.remove(); });

        if (data.error && (!data.people || !data.people.length)) {
            resultsContent.innerHTML = '<div class="error-box"><i class="fas fa-exclamation-circle"></i> ' + escapeHtml(data.error) + '</div>';
            return;
        }

        if (!data.people || !data.people.length) {
            resultsContent.innerHTML = '<div class="empty-box"><i class="fas fa-search"></i><p>No results yet. Use the filters on the left and hit <strong>Search</strong>.</p></div>';
            return;
        }

        resultsContent.innerHTML = buildResultsHTML(data.people);

        // Insert profile templates
        var resultsPanel = document.querySelector(".results-panel");
        if (resultsPanel) resultsPanel.insertAdjacentHTML("afterend", buildProfileTemplatesHTML(data.people));

        // Update credit pills
        if (typeof slUpdateSearchPill === "function" && typeof data.search_credits === "number") slUpdateSearchPill(data.search_credits);
        if (typeof slUpdatePill === "function" && typeof data.credits === "number") slUpdatePill(data.credits);

        // Re-attach enrich events
        attachEnrichEvents();

        // Re-attach selection events
        reattachSelectionEvents();
    }

    function reattachSelectionEvents() {
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

    if (searchForm) {
        searchForm.addEventListener("submit", function (e) {
            e.preventDefault();
            showLoader();

            var formData = new FormData(searchForm);

            fetch(SEARCH_BY_LINKDIN_URL, {
                method: "POST",
                headers: {
                    "X-CSRFToken": CSRF_TOKEN,
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: formData
            })
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                hideLoader();
                if (data.limit_reached) {
                    if (typeof slShowModal === "function") slShowModal(data.credits || 0);
                    return;
                }
                renderAjaxResults(data);
            })
            .catch(function (err) {
                hideLoader();
                console.error("AJAX LinkedIn search error:", err);
                showMessage("Search failed. Please try again.", "error");
            });
        });
    }

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

    // ── Selection UI ──
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

    function collectSelectedPeople() {
        const selected = [];
        document.querySelectorAll(".row-checkbox:checked").forEach(function (cb) {
            selected.push({
                first:               cb.getAttribute("data-first") || "",
                last:                cb.getAttribute("data-last") || "",
                linkedin:            cb.getAttribute("data-linkedin") || "",
                company:             cb.getAttribute("data-company") || "",
                company_website:     cb.getAttribute("data-company_website") || "",
                job_title:           cb.getAttribute("data-job_title") || "",
                institution:         cb.getAttribute("data-institution") || "",
                location:            cb.getAttribute("data-location") || "",
                company_headquarter: cb.getAttribute("data-company_headquarter") || "",
                email:               cb.getAttribute("data-email") || "",
                phone:               cb.getAttribute("data-phone") || ""
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

    if (newListTab) newListTab.addEventListener("click", function () { setTab("new"); });
    if (existingListTab) {
        existingListTab.addEventListener("click", async function () {
            setTab("existing");
            await loadExistingLists();
        });
    }

    if (confirmSaveListBtn) {
        confirmSaveListBtn.addEventListener("click", async function () {
            const selectedPeople = collectSelectedPeople();
            if (!selectedPeople.length) {
                showMessage("Please select at least one person.", "error");
                return;
            }

            const payload = { list_type: activeListMode, people: selectedPeople };

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

                const response = await fetch(SAVE_PEOPLE_TO_LIST_URL, {
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

    // ── Enrich (email/phone fetch) events ──
function attachEnrichEvents() {

    function applyEnrichmentToRow(cardRow, cardId, email, phone, csrfToken) {
        // 1. Update email column cell
        if (email) {
            const emailColCell = document.querySelector(".email-col-" + cardId);
            if (emailColCell) {
                emailColCell.innerHTML =
                    '<span class="contact-col-pill contact-col-email">'
                    + '<i class="far fa-envelope me-1"></i>'
                    + escapeHtml(email)
                    + '</span>';
            }
        }

        // 2. Update phone column cell
        if (phone) {
            const phoneColCell = document.querySelector(".phone-col-" + cardId);
            if (phoneColCell) {
                phoneColCell.innerHTML =
                    '<span class="contact-col-pill contact-col-phone">'
                    + '<i class="fas fa-phone-alt me-1" style="font-size:10px;"></i>'
                    + escapeHtml(phone)
                    + '</span>';
            }
        }

        // 3. Replace email enrich-form with Send Email button
        if (email) {
            const actionTd = cardRow.querySelector(".action-icons");
            if (actionTd) {
                const enrichTypeInput = actionTd.querySelector('.enrich-form input[name="enrich_type"][value="email"]');
                if (enrichTypeInput) {
                    const oldForm = enrichTypeInput.closest("form");
                    if (oldForm) {
                        const cb = cardRow.querySelector(".row-checkbox");
                        const newForm = document.createElement("form");
                        newForm.method = "POST";
                        newForm.action = SELECT_PERSON_FOR_EMAIL_URL;
                        newForm.className = "d-inline";
                        newForm.innerHTML =
                            '<input type="hidden" name="csrfmiddlewaretoken" value="' + escapeHtml(csrfToken) + '">'
                            + '<input type="hidden" name="first"               value="' + escapeHtml(cb ? cb.getAttribute("data-first") || "" : "") + '">'
                            + '<input type="hidden" name="last"                value="' + escapeHtml(cb ? cb.getAttribute("data-last") || "" : "") + '">'
                            + '<input type="hidden" name="linkedin"            value="' + escapeHtml(cb ? cb.getAttribute("data-linkedin") || "" : "") + '">'
                            + '<input type="hidden" name="company"             value="' + escapeHtml(cb ? cb.getAttribute("data-company") || "" : "") + '">'
                            + '<input type="hidden" name="company_website"     value="' + escapeHtml(cb ? cb.getAttribute("data-company_website") || "" : "") + '">'
                            + '<input type="hidden" name="job_title"           value="' + escapeHtml(cb ? cb.getAttribute("data-job_title") || "" : "") + '">'
                            + '<input type="hidden" name="institution"         value="' + escapeHtml(cb ? cb.getAttribute("data-institution") || "" : "") + '">'
                            + '<input type="hidden" name="location"            value="' + escapeHtml(cb ? cb.getAttribute("data-location") || "" : "") + '">'
                            + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(cb ? cb.getAttribute("data-company_headquarter") || "" : "") + '">'
                            + '<input type="hidden" name="email"               value="' + escapeHtml(email) + '">'
                            + '<button type="submit" class="send-email-col-btn" title="Send Email">'
                            + '<i class="far fa-envelope me-1"></i> Send Email</button>';
                        oldForm.replaceWith(newForm);
                    }
                }
            }
        }

        // 4. Sync drawer template
        const profileTpl = document.getElementById("person-profile-" + cardId);
        if (profileTpl) {
            const cb = cardRow.querySelector(".row-checkbox");

            if (email) {
                const contactRows = profileTpl.querySelectorAll(".drawer-contact-row");
                if (contactRows[0]) {
                    const blurredEl = contactRows[0].querySelector(".contact-blurred");
                    if (blurredEl) {
                        blurredEl.className = "contact-val";
                        blurredEl.textContent = email;
                    }
                    const unlockBtn = contactRows[0].querySelector(".drawer-unlock-link");
                    if (unlockBtn) unlockBtn.remove();
                }
                const tplSendBtn = profileTpl.querySelector(".drawer-action-btn.primary");
                if (tplSendBtn && tplSendBtn.disabled) {
                    const tplForm = document.createElement("form");
                    tplForm.method = "POST";
                    tplForm.action = SELECT_PERSON_FOR_EMAIL_URL;
                    tplForm.className = "d-inline";
                    tplForm.style.flex = "1";
                    tplForm.innerHTML =
                        '<input type="hidden" name="csrfmiddlewaretoken" value="' + escapeHtml(csrfToken) + '">'
                        + '<input type="hidden" name="first"               value="' + escapeHtml(cb ? cb.getAttribute("data-first") || "" : "") + '">'
                        + '<input type="hidden" name="last"                value="' + escapeHtml(cb ? cb.getAttribute("data-last") || "" : "") + '">'
                        + '<input type="hidden" name="linkedin"            value="' + escapeHtml(cb ? cb.getAttribute("data-linkedin") || "" : "") + '">'
                        + '<input type="hidden" name="company"             value="' + escapeHtml(cb ? cb.getAttribute("data-company") || "" : "") + '">'
                        + '<input type="hidden" name="company_website"     value="' + escapeHtml(cb ? cb.getAttribute("data-company_website") || "" : "") + '">'
                        + '<input type="hidden" name="job_title"           value="' + escapeHtml(cb ? cb.getAttribute("data-job_title") || "" : "") + '">'
                        + '<input type="hidden" name="institution"         value="' + escapeHtml(cb ? cb.getAttribute("data-institution") || "" : "") + '">'
                        + '<input type="hidden" name="location"            value="' + escapeHtml(cb ? cb.getAttribute("data-location") || "" : "") + '">'
                        + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(cb ? cb.getAttribute("data-company_headquarter") || "" : "") + '">'
                        + '<input type="hidden" name="email"               value="' + escapeHtml(email) + '">'
                        + '<button type="submit" class="drawer-action-btn primary" style="width:100%;"><i class="far fa-envelope"></i> Send Email</button>';
                    tplSendBtn.replaceWith(tplForm);
                }
            }

            if (phone) {
                const contactRows = profileTpl.querySelectorAll(".drawer-contact-row");
                if (contactRows[1]) {
                    const blurredEl = contactRows[1].querySelector(".contact-blurred");
                    if (blurredEl) {
                        blurredEl.className = "contact-val";
                        blurredEl.textContent = phone;
                    }
                    const unlockBtn = contactRows[1].querySelector(".drawer-unlock-link");
                    if (unlockBtn) unlockBtn.remove();
                }
            }
        }
    }

    document.querySelectorAll(".enrich-form").forEach(function (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();

            const formData = new FormData(form);
            const csrfTokenInput = form.querySelector("[name=csrfmiddlewaretoken]");
            const csrfToken = csrfTokenInput ? csrfTokenInput.value : getCookie("csrftoken");
            const cardId = formData.get("card_id");
            const enrichType = formData.get("enrich_type") || "email";

            const cardRow = document.getElementById("person-card-" + cardId);
            if (!cardRow) return;

            const rowCheckbox = cardRow.querySelector(".row-checkbox");
            const existingEmail = rowCheckbox ? (rowCheckbox.getAttribute("data-email") || "") : "";
            const existingPhone = rowCheckbox ? (rowCheckbox.getAttribute("data-phone") || "") : "";

            // Already have data — just update UI
            if (enrichType === "email" && existingEmail) {
                applyEnrichmentToRow(cardRow, cardId, existingEmail, existingPhone, csrfToken);
                return;
            }
            if (enrichType === "phone" && existingPhone) {
                applyEnrichmentToRow(cardRow, cardId, existingEmail, existingPhone, csrfToken);
                return;
            }

            if (loader) loader.style.display = "flex";

            try {
                const response = await fetch(form.action || ENRICH_PERSON_URL, {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": csrfToken,
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: formData
                });

                const data = await response.json();

                if (!data.success) {
                    if (loader) loader.style.display = "none";
                    showMessage(data.error || "Something went wrong.", "error");
                    return;
                }

                // ── Webhook polling flow ──
                if (data.pending && data.request_id) {
                    const requestId = data.request_id;
                    let resolved = false;

                    for (let attempt = 0; attempt < 40; attempt++) {
                        await new Promise(function (res) { setTimeout(res, 3000); });

                        let checkResp, checkData;
                        try {
                            const pollUrl = CHECK_ENRICHMENT_URL.replace("PLACEHOLDER", requestId);
                            checkResp = await fetch(pollUrl, {
                                method: "GET",
                                headers: { "X-Requested-With": "XMLHttpRequest" }
                            });
                            checkData = await checkResp.json();
                        } catch (pollErr) {
                            console.warn("[Poll] fetch error:", pollErr);
                            continue;
                        }

                        if (!checkData.pending) {
                            const existingEmail2 = rowCheckbox ? (rowCheckbox.getAttribute("data-email") || "") : "";
                            const existingPhone2 = rowCheckbox ? (rowCheckbox.getAttribute("data-phone") || "") : "";
                            const fe = checkData.email || existingEmail2;
                            const fp = checkData.phone || existingPhone2;

                            if (rowCheckbox) {
                                if (fe) rowCheckbox.setAttribute("data-email", fe);
                                if (fp) rowCheckbox.setAttribute("data-phone", fp);
                            }

                            applyEnrichmentToRow(cardRow, cardId, fe, fp, getCookie("csrftoken"));

                            if (loader) loader.style.display = "none";

                            if (!fe && !fp) {
                                showMessage("No contact info found.", "error");
                            } else {
                                showMessage("Contact info fetched!", "success");
                            }

                            resolved = true;
                            break;
                        }
                    }

                    if (loader) loader.style.display = "none";
                    if (!resolved) {
                        showMessage("Enrichment taking too long. Try again.", "error");
                    }
                    return;
                }

                // ── Direct response (no webhook) ──
                if (loader) loader.style.display = "none";
                const person = data.person || {};
                const emails = person.emails || [];
                const phones = person.phones || [];
                const firstEmail = typeof emails[0] === "string" ? emails[0] : (emails[0] && emails[0].email ? emails[0].email : "");
                const firstPhone = typeof phones[0] === "string" ? phones[0] : (phones[0] && phones[0].number ? phones[0].number : "");

                const fe = firstEmail || existingEmail;
                const fp = firstPhone || existingPhone;

                if (rowCheckbox) {
                    if (fe) rowCheckbox.setAttribute("data-email", fe);
                    if (fp) rowCheckbox.setAttribute("data-phone", fp);
                }

                applyEnrichmentToRow(cardRow, cardId, fe, fp, csrfToken);

            } catch (error) {
                if (loader) loader.style.display = "none";
                showMessage("Server error while fetching contact.", "error");
                console.error(error);
            }
        });
    });
}

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


    document.addEventListener("click", function (e) {
        const singleSaveBtn = e.target.closest(".single-save-btn");
        if (singleSaveBtn) {
            // Uncheck all first
            document.querySelectorAll(".row-checkbox").forEach(cb => cb.checked = false);
            const selectAll = document.getElementById("selectAllRows");
            if (selectAll) selectAll.checked = false;

            // Check only this row
            const row = singleSaveBtn.closest("tr");
            if (row) {
                const cb = row.querySelector(".row-checkbox");
                if (cb) cb.checked = true;
            }

            // Update UI & trigger modal
            updateSelectionUI();
            const saveToListBtn = document.getElementById("saveToListBtn");
            if (saveToListBtn) saveToListBtn.click();
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

    // ══════════════════════════════════════
    //  PROFILE DRAWER
    // ══════════════════════════════════════
    (function initProfileDrawer() {
        const drawer = document.getElementById("profileDrawer");
        const overlay = document.getElementById("profileDrawerOverlay");
        const closeBtn = document.getElementById("closeProfileDrawer");
        const saveBtn = document.getElementById("drawerSaveToListBtn");
        const drawerContent = document.getElementById("profileDrawerContent");

        if (!drawer || !overlay || !drawerContent) return;

        let currentPersonIdx = null;  // track which row is open

        function openDrawer() {
            overlay.classList.add("active");
            drawer.classList.add("open");
            document.body.style.overflow = "hidden";
        }

        function closeDrawer() {
            overlay.classList.remove("active");
            drawer.classList.remove("open");
            document.body.style.overflow = "";
            currentPersonIdx = null;
            if (saveBtn) saveBtn.classList.remove("saved");
        }

        if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
        overlay.addEventListener("click", closeDrawer);
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeDrawer();
        });

        // Drawer save-to-list button
        if (saveBtn) {
            saveBtn.addEventListener("click", async function () {
                if (currentPersonIdx === null) return;

                // Uncheck all rows, then check only this person
                document.querySelectorAll(".row-checkbox").forEach(cb => cb.checked = false);
                const selectAll = document.getElementById("selectAllRows");
                if (selectAll) selectAll.checked = false;

                const row = document.getElementById("person-card-" + currentPersonIdx);
                if (row) {
                    const cb = row.querySelector(".row-checkbox");
                    if (cb) cb.checked = true;
                }

                updateSelectionUI();
                await loadExistingLists();
                setTab("new");
                openModal();
            });
        }

        // ── Drawer "Save to Unlock" → enrich email ──
        drawerContent.addEventListener("click", async function (e) {
            const unlockBtn = e.target.closest(".drawer-unlock-link");
            if (!unlockBtn) return;
            if (currentPersonIdx === null) return;

            // Get person data from the row checkbox
            const row = document.getElementById("person-card-" + currentPersonIdx);
            if (!row) return;
            const cb = row.querySelector(".row-checkbox");
            if (!cb) return;

            // Loading state
            const origText = unlockBtn.textContent;
            unlockBtn.textContent = "Fetching…";
            unlockBtn.disabled = true;

            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", getCookie("csrftoken"));
            formData.append("linkedin_url",         cb.getAttribute("data-linkedin")           || "");
            formData.append("first",                cb.getAttribute("data-first")              || "");
            formData.append("last",                 cb.getAttribute("data-last")               || "");
            formData.append("company",              cb.getAttribute("data-company")            || "");
            formData.append("company_website",      cb.getAttribute("data-company_website")    || "");
            formData.append("job_title",            cb.getAttribute("data-job_title")          || "");
            formData.append("institution",          cb.getAttribute("data-institution")        || "");
            formData.append("location",             cb.getAttribute("data-location")           || "");
            formData.append("company_headquarter",  cb.getAttribute("data-company_headquarter")|| "");
            formData.append("card_id",              currentPersonIdx);
            formData.append("enrich_type",          "email");

            try {
                const response = await fetch(ENRICH_PERSON_URL, {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": getCookie("csrftoken"),
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: formData
                });
                const data = await response.json();

                if (!data.success) {
                    showMessage(data.error || "Could not fetch email.", "error");
                    unlockBtn.textContent = origText;
                    unlockBtn.disabled = false;
                    return;
                }

                const person  = data.person || {};
                const emails  = person.emails || [];
                const firstEmail = typeof emails[0] === "string"
                    ? emails[0]
                    : (emails[0] && emails[0].email ? emails[0].email : "");

                if (!firstEmail) {
                    showMessage("No email found for this person.", "error");
                    unlockBtn.textContent = origText;
                    unlockBtn.disabled = false;
                    return;
                }

                // 1. Update row checkbox data-email
                cb.setAttribute("data-email", firstEmail);

                // 2. Update the live contact row inside the drawer
                const contactRow = unlockBtn.closest(".drawer-contact-row");
                if (contactRow) {
                    const contactLeft = contactRow.querySelector(".drawer-contact-left");
                    if (contactLeft) {
                        contactLeft.innerHTML =
                            `<i class="far fa-envelope"></i> <span class="contact-val">${escapeHtml(firstEmail)}</span>`;
                    }
                    unlockBtn.remove();
                }

                // 3. Replace the disabled "Send Email" button with a working form
                const existingSendBtn = drawerContent.querySelector(".drawer-action-btn.primary");
                if (existingSendBtn) {
                    const actionsDiv = existingSendBtn.closest(".drawer-actions");
                    if (actionsDiv) {
                        const csrfToken = getCookie("csrftoken");
                        const form = document.createElement("form");
                        form.method  = "POST";
                        form.action  = SELECT_PERSON_FOR_EMAIL_URL;
                        form.className = "d-inline";
                        form.style.flex = "1";
                        form.innerHTML = `
                            <input type="hidden" name="csrfmiddlewaretoken" value="${escapeHtml(csrfToken)}">
                            <input type="hidden" name="first"               value="${escapeHtml(cb.getAttribute("data-first")              || "")}">
                            <input type="hidden" name="last"                value="${escapeHtml(cb.getAttribute("data-last")               || "")}">
                            <input type="hidden" name="linkedin"            value="${escapeHtml(cb.getAttribute("data-linkedin")           || "")}">
                            <input type="hidden" name="company"             value="${escapeHtml(cb.getAttribute("data-company")            || "")}">
                            <input type="hidden" name="company_website"     value="${escapeHtml(cb.getAttribute("data-company_website")    || "")}">
                            <input type="hidden" name="job_title"           value="${escapeHtml(cb.getAttribute("data-job_title")          || "")}">
                            <input type="hidden" name="institution"         value="${escapeHtml(cb.getAttribute("data-institution")        || "")}">
                            <input type="hidden" name="location"            value="${escapeHtml(cb.getAttribute("data-location")           || "")}">
                            <input type="hidden" name="company_headquarter" value="${escapeHtml(cb.getAttribute("data-company_headquarter")|| "")}">
                            <input type="hidden" name="email"               value="${escapeHtml(firstEmail)}">
                            <button type="submit" class="drawer-action-btn primary" style="width:100%;">
                                <i class="far fa-envelope"></i> Send Email
                            </button>
                        `;
                        existingSendBtn.replaceWith(form);
                    }
                }

                // 4. Update the pre-rendered profile template so re-opening the drawer shows the email
                const profileTpl = document.getElementById("person-profile-" + currentPersonIdx);
                if (profileTpl) {
                    // Update blurred email span → real email
                    const blurredEl = profileTpl.querySelector(".contact-blurred");
                    if (blurredEl) {
                        blurredEl.className = "contact-val";
                        blurredEl.textContent = firstEmail;
                    }
                    // Remove the Save to Unlock link from the template
                    const tplUnlock = profileTpl.querySelector(".drawer-unlock-link");
                    if (tplUnlock) tplUnlock.remove();
                    // Update Send Email button in template
                    const tplSendBtn = profileTpl.querySelector(".drawer-action-btn.primary");
                    if (tplSendBtn) {
                        const csrfToken = getCookie("csrftoken");
                        const tplForm = document.createElement("form");
                        tplForm.method = "POST";
                        tplForm.action = SELECT_PERSON_FOR_EMAIL_URL;
                        tplForm.className = "d-inline";
                        tplForm.style.flex = "1";
                        tplForm.innerHTML = `
                            <input type="hidden" name="csrfmiddlewaretoken" value="${escapeHtml(csrfToken)}">
                            <input type="hidden" name="first"               value="${escapeHtml(cb.getAttribute("data-first")              || "")}">
                            <input type="hidden" name="last"                value="${escapeHtml(cb.getAttribute("data-last")               || "")}">
                            <input type="hidden" name="linkedin"            value="${escapeHtml(cb.getAttribute("data-linkedin")           || "")}">
                            <input type="hidden" name="company"             value="${escapeHtml(cb.getAttribute("data-company")            || "")}">
                            <input type="hidden" name="company_website"     value="${escapeHtml(cb.getAttribute("data-company_website")    || "")}">
                            <input type="hidden" name="job_title"           value="${escapeHtml(cb.getAttribute("data-job_title")          || "")}">
                            <input type="hidden" name="institution"         value="${escapeHtml(cb.getAttribute("data-institution")        || "")}">
                            <input type="hidden" name="location"            value="${escapeHtml(cb.getAttribute("data-location")           || "")}">
                            <input type="hidden" name="company_headquarter" value="${escapeHtml(cb.getAttribute("data-company_headquarter")|| "")}">
                            <input type="hidden" name="email"               value="${escapeHtml(firstEmail)}">
                            <button type="submit" class="drawer-action-btn primary" style="width:100%;">
                                <i class="far fa-envelope"></i> Send Email
                            </button>
                        `;
                        tplSendBtn.replaceWith(tplForm);
                    }
                }

                showMessage("Email fetched successfully!", "success");

            } catch (err) {
                console.error("Drawer enrich error:", err);
                showMessage("Server error while fetching email.", "error");
                unlockBtn.textContent = origText;
                unlockBtn.disabled = false;
            }
        });


        // Click on drawer-trigger cells
        document.addEventListener("click", function (e) {
            const trigger = e.target.closest(".drawer-trigger");
            if (!trigger) return;

            // Don't open if clicking a link inside the cell
            if (e.target.closest("a")) return;

            const row = trigger.closest("tr");
            if (!row) return;

            // Get the person index from the row ID (e.g. "person-card-3" → "3")
            const rowId = row.id || "";
            const personIdx = rowId.replace("person-card-", "");
            if (!personIdx) return;

            // Look up the pre-rendered profile div
            const profileTpl = document.getElementById("person-profile-" + personIdx);
            if (!profileTpl) return;

            // Clone the pre-rendered HTML into the drawer body
            drawerContent.innerHTML = profileTpl.innerHTML;
            currentPersonIdx = personIdx;

            openDrawer();
        });

        function buildDrawerHTML(d) {
            const fullName = [d.first, d.last].filter(Boolean).join(" ") || "Unknown";
            const initials = [(d.first || "").slice(0, 1), (d.last || "").slice(0, 1)].join("").toUpperCase() || "?";
            const photoUrl = d.photo || "";

            // ── Hero ──
            const liLink = d.linkedin
                ? `<a href="${esc(d.linkedin)}" target="_blank" class="li-badge" title="LinkedIn" style="text-decoration:none;">in</a>`
                : "";
            const liLinkName = d.linkedin
                ? `<a href="${esc(d.linkedin)}" target="_blank" style="color:inherit;text-decoration:none;">${esc(fullName)}</a>`
                : esc(fullName);

            let metaRows = "";
            if (d.location) {
                metaRows += `<div class="drawer-meta-item"><i class="fas fa-map-marker-alt"></i><span>${esc(d.location)}</span></div>`;
            }
            if (d.company_headquarter) {
                metaRows += `<div class="drawer-meta-item"><i class="fas fa-map-pin"></i><span>${esc(d.company_headquarter)}</span></div>`;
            }
            if (d.department) {
                metaRows += `<div class="drawer-meta-item"><i class="fas fa-sitemap"></i><span>${esc(d.department)}</span></div>`;
            }

            let tagRow = "";
            if (d.company) {
                const companyInner = d.company_website
                    ? `<a href="${esc(d.company_website)}" target="_blank" style="color:inherit;text-decoration:none;">${esc(d.company)}</a>`
                    : esc(d.company);
                tagRow += `<span class="drawer-tag"><i class="fas fa-building"></i>${companyInner}</span>`;
            }
            if (d.institution) {
                tagRow += `<span class="drawer-tag"><i class="fas fa-graduation-cap"></i>${esc(d.institution)}</span>`;
            }
            if (d.linkedin) {
                tagRow += `<a href="${esc(d.linkedin)}" target="_blank" class="drawer-tag li-tag" style="text-decoration:none;"><i class="fab fa-linkedin-in"></i>LinkedIn</a>`;
            }

            // ── Contacts ──
            let contactRows = "";
            if (d.email) {
                contactRows += `
                    <div class="drawer-contact-row">
                        <div class="drawer-contact-left">
                            <i class="far fa-envelope"></i>
                            <span class="contact-val">${esc(d.email)}</span>
                        </div>
                    </div>`;
            } else {
                contactRows += `
                    <div class="drawer-contact-row">
                        <div class="drawer-contact-left">
                            <i class="far fa-envelope"></i>
                            <span class="contact-blurred">***@******.***</span>
                        </div>
                        <button class="drawer-unlock-btn" type="button">
                            <i class="fas fa-lock" style="font-size:10px;"></i> Save to Unlock
                        </button>
                    </div>`;
            }

            if (d.phone) {
                contactRows += `
                    <div class="drawer-contact-row">
                        <div class="drawer-contact-left">
                            <i class="fas fa-phone-alt"></i>
                            <span class="contact-val">${esc(d.phone)}</span>
                        </div>
                    </div>`;
            } else {
                contactRows += `
                    <div class="drawer-contact-row">
                        <div class="drawer-contact-left">
                            <i class="fas fa-phone-alt"></i>
                            <span class="contact-blurred">+** **-****-****</span>
                        </div>
                        <button class="drawer-unlock-btn" type="button">
                            <i class="fas fa-lock" style="font-size:10px;"></i> Save to Unlock
                        </button>
                    </div>`;
            }

            // ── Tenure Stats ──
            let tenureSection = "";
            if (d.total_experience || d.avg_tenure || d.cur_tenure) {
                tenureSection = `
                    <div class="drawer-section">
                        <div class="drawer-section-title">Work Experience</div>
                        <div class="drawer-tenure-stats">
                            ${d.total_experience ? `<div class="drawer-tenure-card"><div class="tenure-label">Total Tenure</div><div class="tenure-value">${esc(d.total_experience)}</div></div>` : ""}
                            ${d.avg_tenure ? `<div class="drawer-tenure-card"><div class="tenure-label">Average Tenure</div><div class="tenure-value">${esc(d.avg_tenure)}</div></div>` : ""}
                            ${d.cur_tenure ? `<div class="drawer-tenure-card"><div class="tenure-label">Current Tenure</div><div class="tenure-value">${esc(d.cur_tenure)}</div></div>` : ""}
                        </div>
                        ${buildExperienceList(d.experience || [])}
                    </div>`;
            } else if ((d.experience || []).length > 0) {
                tenureSection = `
                    <div class="drawer-section">
                        <div class="drawer-section-title">Work Experience</div>
                        ${buildExperienceList(d.experience)}
                    </div>`;
            }

            // ── Education Section ──
            let educationSection = "";
            if ((d.education || []).length > 0) {
                educationSection = `
                    <div class="drawer-section">
                        <div class="drawer-section-title">Education</div>
                        ${buildEducationList(d.education)}
                    </div>`;
            }

            // ── Skills Section ──
            let skillsSection = `
                <div class="drawer-section">
                    <div class="drawer-section-title">Skills</div>
                    ${
                        (d.skills || []).length > 0
                            ? `<div class="drawer-skills-wrap">${d.skills.map(s => `<span class="drawer-skill-chip">${esc(s)}</span>`).join("")}</div>`
                            : `<div class="drawer-no-data">No skills available</div>`
                    }
                </div>`;

            // ── Action buttons ──
            const emailActionBtn = d.email
                ? `<button class="drawer-action-btn primary" type="button" onclick="window.location.href='mailto:${esc(d.email)}'"><i class="far fa-envelope"></i> Send Email</button>`
                : `<button class="drawer-action-btn primary" type="button" disabled style="opacity:.5;cursor:not-allowed;"><i class="far fa-envelope"></i> Send Email</button>`;
            const liBtn = d.linkedin
                ? `<a href="${esc(d.linkedin)}" target="_blank" class="drawer-action-btn secondary"><i class="fab fa-linkedin-in"></i> LinkedIn</a>`
                : `<button class="drawer-action-btn secondary" type="button" disabled style="opacity:.5;cursor:not-allowed;"><i class="fab fa-linkedin-in"></i> LinkedIn</button>`;

            const avatarContent = photoUrl
                ? `<img src="${esc(photoUrl)}" alt="${esc(fullName)}" onerror="this.style.display='none'; this.nextSibling.style.display='flex'; ">${initials}`
                : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${esc(initials)}</span>`;

            return `
                <div class="drawer-hero">
                    <div class="drawer-hero-top">
                        <div class="drawer-avatar">${avatarContent}</div>
                        <div class="drawer-name-block">
                            <div class="drawer-name">
                                ${liLinkName}
                                ${liLink}
                            </div>
                            ${d.job_title ? `<div class="drawer-job">${esc(d.job_title)}</div>` : ""}
                        </div>
                    </div>
                    <div class="drawer-meta-row">${metaRows}</div>
                    ${tagRow ? `<div class="drawer-tag-row">${tagRow}</div>` : ""}
                </div>

                <div class="drawer-section">
                    <div class="drawer-section-title">Contacts</div>
                    ${contactRows}
                </div>

                ${tenureSection}
                ${educationSection}
                ${skillsSection}

                <div class="drawer-actions">
                    ${emailActionBtn}
                    ${liBtn}
                </div>
            `;
        }

        function buildExperienceList(list) {
            if (!list || !list.length) return "";
            return list.map(exp => {
                const dateRange = [exp.date_from, exp.date_to].filter(Boolean).join(" - ");
                const companyAndLocation = [exp.company, exp.location].filter(Boolean).join(" | ");
                const companyLink = exp.company_url
                    ? `<a href="${esc(exp.company_url)}" target="_blank" style="color:inherit;text-decoration:none;">${esc(companyAndLocation)}</a>`
                    : `<span>${esc(companyAndLocation)}</span>`;

                // Build description bullet points
                let descHtml = "";
                if (exp.description) {
                    const bullets = String(exp.description)
                        .split(/•|\n/)
                        .map(s => s.trim())
                        .filter(Boolean);
                    if (bullets.length > 1) {
                        descHtml = `<ul class="drawer-exp-desc">${bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>`;
                    } else if (bullets.length === 1) {
                        descHtml = `<div class="drawer-exp-desc-text">${esc(bullets[0])}</div>`;
                    }
                }

                return `
                    <div class="drawer-exp-item">
                        <div class="drawer-exp-icon"><i class="fas fa-briefcase"></i></div>
                        <div class="drawer-exp-body">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                                <div class="drawer-exp-title">${esc(exp.title)}</div>
                                ${dateRange ? `<div class="drawer-exp-date">${esc(dateRange)}</div>` : ""}
                            </div>
                            <div class="drawer-exp-company">${companyLink}${exp.duration ? ` <span class="drawer-exp-duration">· ${esc(exp.duration)}</span>` : ""}</div>
                            ${descHtml}
                        </div>
                    </div>`;
            }).join("");
        }

        function buildEducationList(list) {
            if (!list || !list.length) return "";
            return list.map(edu => {
                const dateRange = [edu.date_from, edu.date_to].filter(Boolean).join(" - ");
                return `
                    <div class="drawer-exp-item">
                        <div class="drawer-exp-icon" style="background:#e8f0f9;"><i class="fas fa-graduation-cap" style="color:#1a73e8;"></i></div>
                        <div class="drawer-exp-body">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                                <div class="drawer-exp-title">${esc(edu.title)}</div>
                                ${dateRange ? `<div class="drawer-exp-date">${esc(dateRange)}</div>` : ""}
                            </div>
                            ${edu.major ? `<div class="drawer-exp-company"><a href="#" style="color:#1a73e8;text-decoration:none;">${esc(edu.major)}</a></div>` : ""}
                        </div>
                    </div>`;
            }).join("");
        }
    })();

    // ── Init ──
    setTab("new");
    updateSelectionUI();
    attachEnrichEvents();
});