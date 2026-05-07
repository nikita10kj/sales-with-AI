document.addEventListener("DOMContentLoaded", function () {

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

    const loader = document.getElementById("enrichLoader");
    const peopleSearchForm = document.getElementById("peopleSearchForm");

    const tagInputInstances = [];

    document.querySelectorAll(".filter-toggle").forEach(function (button) {
        button.addEventListener("click", function () {
            const parent = button.closest(".filter-item");
            if (parent) {
                parent.classList.toggle("active");
            }
        });
    });

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
                tag.innerHTML = '<span class="tag-text">' + escapeHtml(tagValue) + '</span>'
                    + '<span class="tag-remove" data-index="' + index + '">&times;</span>';
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

        function addTag(value) {
            const finalValue = (value !== undefined && value !== null ? value : input.value).trim();
            if (!finalValue) return;
            const alreadyExists = tags.some(function (tag) {
                return tag.toLowerCase() === finalValue.toLowerCase();
            });
            if (alreadyExists) { input.value = ""; return; }
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
            if (e.key === "Enter") { e.preventDefault(); addTag(); }
            if (e.key === ",") {
                e.preventDefault();
                const inputValue = input.value.trim();
                if (inputValue) {
                    // Split by comma and add each non-empty part as a tag
                    const values = inputValue.split(",").map(v => v.trim()).filter(v => v !== "");
                    values.forEach(function(v) { addTag(v); });
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

    setupTagInput({ inputId: "nameInput",        addBtnId: "addNameTag",        tagsContainerId: "nameTags",        hiddenInputId: "nameHidden" });
    setupTagInput({ inputId: "locationInput",    addBtnId: "addLocationTag",    tagsContainerId: "locationTags",    hiddenInputId: "locationHidden" });
    setupTagInput({ inputId: "companyInput",     addBtnId: "addCompanyTag",     tagsContainerId: "companyTags",     hiddenInputId: "companyHidden" });
    setupTagInput({ inputId: "specialitesInput", addBtnId: "addSpecialitesTag", tagsContainerId: "specialitesTags", hiddenInputId: "specialitesHidden" });
    setupTagInput({ inputId: "industryInput",    addBtnId: "addIndustryTag",    tagsContainerId: "industryTags",    hiddenInputId: "industryHidden" });
    setupTagInput({ inputId: "jobTitleInput",    addBtnId: "addJobTitleTag",    tagsContainerId: "jobTitleTags",    hiddenInputId: "jobTitleHidden" });
    setupTagInput({ inputId: "skillsInput",      addBtnId: "addSkillsTag",      tagsContainerId: "skillsTags",      hiddenInputId: "skillsHidden" });
    setupTagInput({ inputId: "institutionInput", addBtnId: "addInstitutionTag", tagsContainerId: "institutionTags", hiddenInputId: "institutionHidden" });
    setupTagInput({ inputId: "degreeInput",      addBtnId: "addDegreeTag",      tagsContainerId: "degreeTags",      hiddenInputId: "degreeHidden" });

    // ── AJAX Search helpers ──
    const searchLoaderOverlay = document.getElementById("searchLoaderOverlay");

    function showSearchLoader() {
        if (searchLoaderOverlay) searchLoaderOverlay.classList.add("active");
    }
    function hideSearchLoader() {
        if (searchLoaderOverlay) searchLoaderOverlay.classList.remove("active");
    }

    function buildResultsHTML(people, pagination, searchCredits, credits) {
        if (!people || !people.length) {
    return '<div class="empty-state-box">'
        + '<div class="empty-state-icon"><i class="fas fa-users-slash"></i></div>'
        + '<div class="empty-state-title">No people found</div>'
        + '<div class="empty-state-subtitle">We couldn\'t find anyone matching your current filters.</div>'
        // + '<div class="empty-state-tips">'
        // +   '<div class="empty-state-tips-title"><i class="fas fa-lightbulb"></i> Try these tips</div>'
        // // +   '<ul>'
        // // +     '<li>Use fewer or broader filters</li>'
        // // +     '<li>Check for spelling mistakes</li>'
        // // +     '<li>Try a different location or job title</li>'
        // // +     '<li>Remove the seniority or industry filter</li>'
        // // +   '</ul>'
        // + '</div>'
        + '</div>';
}

        let html = '<div class="results-card" id="resultsCard">';

        // ── Compute pagination values FIRST so meta bar can use them ──
        var cur      = (pagination && pagination.current) || 1;
        var total    = (pagination && pagination.total)   || 0;
        var pageSize = people.length;
        var startIdx = (cur - 1) * pageSize + 1;
        var endIdx   = Math.min(startIdx + pageSize - 1, total);

        // meta bar
        html += '<div class="results-meta"><div class="results-meta-left">'
            + '<input type="checkbox" id="selectAllRows">'
            + ' <i class="fas fa-chevron-down" style="font-size:11px;color:#aab0c4;cursor:pointer;"></i>'
            + ' <span id="selectedCountText">0 selected of ' + people.length + ' results</span>'
            + '</div><div class="results-meta-right">'
            + '<span style="font-size:13px;color:#6a7388;margin-right:12px;">' + startIdx + '–' + endIdx + ' of ' + total + '</span>'
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
            var initials = (p.first || "U").charAt(0) + (p.last || "").charAt(0);
            var richJsonAttr = escapeHtml(p.rich_json || "{}");

            html += '<tr id="person-card-' + idx + '" data-person="' + richJsonAttr + '">';

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
                + ' data-photo="' + escapeHtml(p.photo || "") + '"'
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

            // job title
            html += '<td class="cell-truncate drawer-trigger" data-tooltip="' + escapeHtml(p.job_title || '') + '">' + escapeHtml(p.job_title || "—") + '</td>';

            // location
            html += '<td class="cell-truncate drawer-trigger"' + (p.location ? ' data-tooltip="' + escapeHtml(p.location) + '"' : '') + '>';
            html += p.location ? '<span class="cell-icon"><i class="fas fa-map-marker-alt"></i></span>' + escapeHtml(p.location) : '—';
            html += '</td>';

            // company
            html += '<td class="cell-truncate"' + (p.company ? ' data-tooltip="' + escapeHtml(p.company) + '"' : '') + '>';
            if (p.company) {
                if (p.company_website) html += '<a href="' + escapeHtml(p.company_website) + '" target="_blank" class="company-link">';
                html += '<span class="cell-icon"><i class="fas fa-building"></i></span>' + escapeHtml(p.company);
                if (p.company_website) html += '</a>';
            } else html += '—';
            html += '</td>';

            // HQ location
            html += '<td class="cell-truncate drawer-trigger"' + (p.company_headquarter ? ' data-tooltip="' + escapeHtml(p.company_headquarter) + '"' : '') + '>';
            html += p.company_headquarter ? '<span class="cell-icon"><i class="fas fa-map-marker-alt"></i></span>' + escapeHtml(p.company_headquarter) : '—';
            html += '</td>';

            // institution
            html += '<td class="cell-truncate"' + (p.institution ? ' data-tooltip="' + escapeHtml(p.institution) + '"' : '') + '>';
            html += p.institution ? '<span class="cell-icon"><i class="fas fa-graduation-cap"></i></span>' + escapeHtml(p.institution) : '—';
            html += '</td>';

            // LinkedIn URL
            html += '<td class="cell-truncate"' + (p.linkedin ? ' data-tooltip="' + escapeHtml(p.linkedin) + '"' : '') + '>';
            html += p.linkedin ? '<a href="' + escapeHtml(p.linkedin) + '" target="_blank" class="linkedin-url-link"><i class="fab fa-linkedin" style="color:#0a66c2;margin-right:5px;"></i>View Profile</a>' : '—';
            html += '</td>';

            // Email
            var hasEmail = p.emails && p.emails[0] && p.emails[0].email;
            html += '<td class="email-col-' + idx + '" style="min-width:180px;">';
            if (hasEmail) {
                html += '<span class="contact-col-pill contact-col-email"><i class="far fa-envelope me-1"></i>' + escapeHtml(p.emails[0].email) + '</span>';
            } else {
                html += '<span class="contact-col-blurred">***@*****</span>';
            }
            html += '</td>';

            // Phone
            var hasPhone = p.phones && p.phones[0] && p.phones[0].number;
            html += '<td class="phone-col-' + idx + '" style="min-width:130px;">';
            if (hasPhone) {
                html += '<span class="contact-col-pill contact-col-phone"><i class="fas fa-phone-alt me-1" style="font-size:10px;"></i>' + escapeHtml(p.phones[0].number) + '</span>';
            } else {
                html += '<span class="contact-col-blurred">***-****</span>';
            }
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
            // phone enrich
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
            // extra row for expand
            html += '<tr class="person-extra-row" id="person-extra-' + idx + '" style="display:none;"><td colspan="11" style="background:#fafbfe;padding:0;"><div class="person-extra-box" style="padding:16px 18px;"><div class="person-extra-content"></div></div></td></tr>';
        });

        html += '</tbody></table></div>';

        
       // ── Pagination ──
        var cur        = (pagination && pagination.current)     || 1;
        var total      = (pagination && pagination.total)       || 0;
        var totalPages = (pagination && pagination.total_pages) || (pagination && pagination.last_page) || 1;
        var pageSize   = people.length;
        var startIdx   = (cur - 1) * pageSize + 1;
        var endIdx     = startIdx + pageSize - 1;

        function buildPageRange(cur, total, window) {
            var pages = [];
            var left  = Math.max(1, cur - window);
            var right = Math.min(total, cur + window);
            if (left > 1)  { pages.push(1); if (left > 2)  pages.push(-1); }
            for (var p = left; p <= right; p++) pages.push(p);
            if (right < total) { if (right < total - 1) pages.push(-1); pages.push(total); }
            return pages;
        }

        var pageRange = (pagination && pagination.page_range) || buildPageRange(cur, totalPages, 2);
        var hasNext   = pagination && pagination.has_next;

        html += '<div class="results-footer"><div class="pagination-wrap">';

        // First
        html += '<button class="page-btn page-btn-text" type="button"'
            + (cur <= 1 ? ' disabled' : ' onclick="changePage(1)"')
            + '>&lt;&lt; First</button>';

        // Prev
        html += '<button class="page-btn page-btn-text" type="button"'
            + (cur <= 1 ? ' disabled' : ' onclick="changePage(' + (cur - 1) + ')"')
            + '>&lt; Prev</button>';

        // Page numbers
        pageRange.forEach(function(p) {
            if (p === -1) {
                html += '<span class="page-ellipsis">…</span>';
            } else if (p === cur) {
                html += '<button class="page-btn page-num active" type="button">' + p + '</button>';
            } else {
                html += '<button class="page-btn page-num" type="button" onclick="changePage(' + p + ')">' + p + '</button>';
            }
        });

        // Next
        html += '<button class="page-btn page-btn-text" type="button"'
            + (hasNext ? ' onclick="changePage(' + (cur + 1) + ')"' : ' disabled')
            + '>Next &gt;</button>';

        // Last
        html += '<button class="page-btn page-btn-text" type="button"'
            + (cur >= totalPages ? ' disabled' : ' onclick="changePage(' + totalPages + ')"')
            + '>Last &gt;&gt;</button>';

        html += '</div></div>';
        html += '</div>'; // close results-card

        return html

        }

    function buildProfileTemplatesHTML(people) {
        var html = '';
        people.forEach(function (p, i) {
            var idx = i + 1;
            var initials = (p.first || "U").charAt(0) + (p.last || "").charAt(0);
            var rich = {};
            try { rich = JSON.parse(p.rich_json || "{}"); } catch(e) {}

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
            } else {
                html += escapeHtml(p.first + ' ' + p.last);
            }
            html += '</div>';
            if (p.job_title) html += '<div class="drawer-job">' + escapeHtml(p.job_title) + '</div>';
            html += '</div></div>';

            // Meta
            html += '<div class="drawer-meta-row">';
            if (p.location) html += '<div class="drawer-meta-item"><i class="fas fa-map-marker-alt"></i><span>' + escapeHtml(p.location) + '</span></div>';
            if (p.company_headquarter) html += '<div class="drawer-meta-item"><i class="fas fa-map-pin"></i><span>' + escapeHtml(p.company_headquarter) + '</span></div>';
            if (rich.department) html += '<div class="drawer-meta-item"><i class="fas fa-sitemap"></i><span>' + escapeHtml(rich.department) + '</span></div>';
            html += '</div>';

            // Tags
            html += '<div class="drawer-tag-row">';
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

            // Work Experience (simplified)
            html += '<div class="drawer-section"><div class="drawer-section-title">Work Experience</div>';
            var exps = p.experience || rich.experience || [];
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
            var skills = p.skills_list || rich.skills || [];
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
            html += '</div>';

            html += '</div>';
        });
        return html;
    }

    function renderAjaxResults(data) {
        var resultsContent = document.querySelector(".results-content");
        if (!resultsContent) return;

        document.querySelectorAll(".error-box, .empty-state-box").forEach(function(el) { el.remove(); });
        var oldCard = document.getElementById("resultsCard");
        if (oldCard) oldCard.remove();
        document.querySelectorAll(".person-profile-tpl").forEach(function(el) { el.remove(); });

        // Hide AI panel, show results
        var aiPanel = document.getElementById("aiSearchPanel");
        var errBox = document.getElementById("searchErrorBox");
        if (errBox) errBox.remove();

        if (data.error && !data.people.length) {
            // Remove old results
            // var oldCard = document.getElementById("resultsCard");
            // if (oldCard) oldCard.remove();
            // // Remove old profile templates
            // document.querySelectorAll(".person-profile-tpl").forEach(function(el) { el.remove(); });

            var errDiv = document.createElement("div");
            // errDiv.className = "error-box";

            errDiv.className = "empty-state-box";
            errDiv.innerHTML =
                '<div class="empty-state-icon"><i class="fas fa-users-slash"></i></div>'
                + '<div class="empty-state-title">No people found</div>'
                + '<div class="empty-state-subtitle">We couldn\'t find anyone matching your current filters.</div>'
                + '<div class="empty-state-tips">'
                +   '<div class="empty-state-tips-title"><i class="fas fa-lightbulb"></i> Try these tips</div>'
                +   '<ul>'
                +     '<li>Use fewer or broader filters</li>'
                +     '<li>Check for spelling mistakes</li>'
                +     '<li>Try a different location or job title</li>'
                +     '<li>Remove the seniority or industry filter</li>'
                +   '</ul>'
                + '</div>';
            errDiv.id = "searchErrorBox";
            resultsContent.insertBefore(errDiv, resultsContent.firstChild);
            if (aiPanel) aiPanel.style.display = "";
            return;
        }

        if (aiPanel) aiPanel.style.display = "none";

        // Remove old results card
        var oldCard = document.getElementById("resultsCard");
        if (oldCard) oldCard.remove();

        // Remove old profile templates
        document.querySelectorAll(".person-profile-tpl").forEach(function(el) { el.remove(); });

        // Insert new results
        resultsContent.insertAdjacentHTML("beforeend", buildResultsHTML(data.people, data.pagination, data.search_credits, data.credits));

        // Insert new profile templates (after results-panel closing div)
        var resultsPanel = document.querySelector(".results-panel");
        if (resultsPanel) {
            resultsPanel.insertAdjacentHTML("afterend", buildProfileTemplatesHTML(data.people));
        }

        // Update credit pills
        if (typeof slUpdateSearchPill === "function" && typeof data.search_credits === "number") {
            slUpdateSearchPill(data.search_credits);
        }
        if (typeof slUpdatePill === "function" && typeof data.credits === "number") {
            slUpdatePill(data.credits);
        }

        // Re-attach all dynamic event handlers
        attachEnrichEvents();
        reattachSelectionEvents();
    }

    function reattachSelectionEvents() {
        var newRowCheckboxes = document.querySelectorAll(".row-checkbox");
        var newSelectAll = document.getElementById("selectAllRows");
        var newSelectedText = document.getElementById("selectedCountText");
        var newSaveBtn = document.getElementById("saveToListBtn");

        function updateUI() {
            if (!newSelectedText || !newSaveBtn) return;
            var checked = document.querySelectorAll(".row-checkbox:checked").length;
            var total = document.querySelectorAll(".row-checkbox").length;
            newSelectedText.textContent = checked + " selected of " + total + " results";
            newSaveBtn.style.display = checked > 0 ? "inline-flex" : "none";
            if (newSelectAll) newSelectAll.checked = total > 0 && checked === total;
        }

        if (newSelectAll) {
            newSelectAll.addEventListener("change", function () {
                document.querySelectorAll(".row-checkbox").forEach(function (cb) { cb.checked = newSelectAll.checked; });
                updateUI();
            });
        }
        newRowCheckboxes.forEach(function (cb) { cb.addEventListener("change", updateUI); });

        if (newSaveBtn) {
            newSaveBtn.addEventListener("click", async function () {
                await loadExistingLists();
                setTab("new");
                openModal();
            });
        }

        // Update contact pill count
        var contactPill = document.getElementById("contactPill");
        if (contactPill) {
            contactPill.textContent = "0/" + newRowCheckboxes.length;
        }
    }

    // ── The main AJAX search function ──
    window.doAjaxSearch = function (pageOverride) {
        // Finalize pending tag inputs
        tagInputInstances.forEach(function (inst) { inst.finalizePendingInput(); });

        var formData = new FormData(peopleSearchForm);
        if (pageOverride) formData.set("page", pageOverride);

        showSearchLoader();

        fetch(SEARCH_PEOPLE_URL, {
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

            renderAjaxResults(data);
        })
        .catch(function (err) {
            hideSearchLoader();
            console.error("AJAX search error:", err);
            showMessage("Search failed. Please try again.", "error");
        });
    };

    if (peopleSearchForm) {
        peopleSearchForm.addEventListener("submit", function (e) {
            e.preventDefault();
            window.doAjaxSearch();
        });
    }

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
        selectedCountText.textContent = checkedCount + " selected of " + totalCount + " results";
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
                phone:               cb.getAttribute("data-phone") || "",
                photo:               cb.getAttribute("data-photo") || ""
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

    rowCheckboxes.forEach(function (cb) { cb.addEventListener("change", updateSelectionUI); });

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
            confirmSaveListBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
 
            const response = await fetch(SAVE_ENRICH_CAMPAIGN_URL, {
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
                if (data.limit_reached && typeof slShowModal === "function") {
                    slShowModal(data.credits || 0);
                } else {
                    showMessage(data.error || "Could not save list.", "error");
                }
                confirmSaveListBtn.disabled = false;
                confirmSaveListBtn.innerHTML = "Save to List";
                return;
            }
 
            // ── No enrichment needed → redirect immediately ──────────────
            if (!data.pending || !data.request_ids || !data.request_ids.length) {
                confirmSaveListBtn.innerHTML = "✅ Done! Redirecting...";
                showMessage(data.message || "Saved successfully.", "success");
                closeModal();
                setTimeout(function () { window.location.href = data.redirect_url; }, 1200);
                return;
            }
 
            // ── Enrichment pending → poll CheckBulkEnrichmentView ────────
            const requestIds  = data.request_ids;
            const redirectUrl = data.redirect_url;
            const total       = requestIds.length;
 
            closeModal();
            // showMessage(`Enriching ${total} contacts… this may take a moment.`, "success");
            showMessage("Enriching " + total + " contacts\u2026 this may take a moment.", "success");
 
            // Show a persistent progress bar while polling
            let progressBar = document.getElementById("enrichProgressBar");
            if (!progressBar) {
                progressBar = document.createElement("div");
                progressBar.id = "enrichProgressBar";
                progressBar.style.cssText = [
                    "position:fixed", "bottom:20px", "left:50%",
                    "transform:translateX(-50%)",
                    "background:#fff", "border-radius:14px",
                    "box-shadow:0 4px 24px rgba(0,0,0,.15)",
                    "padding:16px 24px", "z-index:99999",
                    "min-width:300px", "text-align:center",
                    "font-size:14px", "font-weight:600", "color:#2e374d"
                ].join(";");
                document.body.appendChild(progressBar);
            }
 
            // function updateProgress(done, total) {
            //     const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            //     progressBar.innerHTML =
            //         `<i class="fas fa-spinner fa-spin me-2" style="color:#6276ea;"></i>` +
            //         `Enriching contacts… ${done}/${total} done` +
            //         `<div style="margin-top:10px;height:6px;background:#eef0f4;border-radius:99px;overflow:hidden;">` +
            //         `<div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6276ea,#7c4fc8);border-radius:99px;transition:width .4s;"></div>` +
            //         `</div>`;
            // }

            function updateProgress(done, total) {
                    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    progressBar.innerHTML =
                        '<i class="fas fa-spinner fa-spin me-2" style="color:#6276ea;"></i>'
                        + 'Enriching contacts\u2026 ' + done + '/' + total + ' done'
                        + '<div style="margin-top:10px;height:6px;background:#eef0f4;border-radius:99px;overflow:hidden;">'
                        + '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#6276ea,#7c4fc8);border-radius:99px;transition:width .4s;"></div>'
                        + '</div>';
                }
 
            updateProgress(0, total);
 
            // Poll every 3 seconds for up to 40 attempts (2 minutes)
            let allDone = false;
            for (let attempt = 0; attempt < 40; attempt++) {
                await new Promise(function (res) { setTimeout(res, 3000); });
 
                let checkData;
                try {
                    const pollResp = await fetch(
                        CHECK_BULK_ENRICHMENT_URL + "?request_ids=" + requestIds.join(","),
                        { headers: { "X-Requested-With": "XMLHttpRequest" } }
                    );
                    checkData = await pollResp.json();
                } catch (pollErr) {
                    console.warn("[Bulk enrich poll] fetch error:", pollErr);
                    continue;
                }

                if (checkData.limit_reached) {
                    if (progressBar) progressBar.remove();
                    if (typeof slShowModal === "function") slShowModal(checkData.credits || 0);
                    confirmSaveListBtn.disabled = false;
                    confirmSaveListBtn.innerHTML = "Save to List";
                    return;
                }

                updateProgress(checkData.done || 0, checkData.total || total);

                // Update credit pill if server returned updated count
                if (typeof checkData.credits === "number") {                    if (typeof slUpdatePill === "function") slUpdatePill(checkData.credits);
                }
 
                if (checkData.all_done) {
                    allDone = true;
                    break;
                }
            }
 
            // Remove progress bar and redirect
            if (progressBar) progressBar.remove();
 
            if (allDone) {
                showMessage("Enrichment complete! Redirecting to campaign...", "success");
            } else {
                // Timed out but still redirect — emails enriched so far are saved
                showMessage("Enrichment is still running in background. Redirecting...", "success");
            }
 
            setTimeout(function () { window.location.href = redirectUrl; }, 1500);
 
        } catch (error) {
            console.error("Save & enrich error:", error);
            showMessage("Server error while saving list.", "error");
            confirmSaveListBtn.disabled = false;
            confirmSaveListBtn.innerHTML = "Save to List";
        }
    });
}

    // ══════════════════════════════════════
    //  ENRICH EVENTS
    // ══════════════════════════════════════
    function attachEnrichEvents() {

        function getRowData(cardRow) {
            if (!cardRow) return {};
            const cb = cardRow.querySelector(".row-checkbox");
            if (!cb) return {};
            return {
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
            };
        }

        // ── Update table cells and action button after enrichment resolves ──
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

    // ── 4. ADD THIS BLOCK — Sync drawer template so opening drawer shows fetched data ──
    const profileTpl = document.getElementById("person-profile-" + cardId);
    if (profileTpl) {
        const cb = cardRow.querySelector(".row-checkbox");

        if (email) {
            // Show email instead of blurred
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

            // Replace disabled Send Email button with working form
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
            // Show phone instead of blurred
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
    // ── END OF ADDED BLOCK ──
}

        function getFirstEmail(person) {
            if (!person.emails || !person.emails.length) return "";
            return typeof person.emails[0] === "string"
                ? person.emails[0]
                : (person.emails[0].email || "");
        }

        function getFirstPhone(person) {
            if (!person.phones || !person.phones.length) return "";
            return typeof person.phones[0] === "string"
                ? person.phones[0]
                : (person.phones[0].number || "");
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
                const extraRow = document.getElementById("person-extra-" + cardId);

                if (!cardRow) return;

                const rowCheckbox = cardRow.querySelector(".row-checkbox");
                const existingEmail = rowCheckbox ? (rowCheckbox.getAttribute("data-email") || "") : "";
                const existingPhone = rowCheckbox ? (rowCheckbox.getAttribute("data-phone") || "") : "";

                // Already have the data — just update cells immediately
                if (enrichType === "email" && existingEmail) {
                    applyEnrichmentToRow(cardRow, cardId, existingEmail, existingPhone, csrfToken);
                    if (extraRow) extraRow.style.display = "none";
                    return;
                }
                if (enrichType === "phone" && existingPhone) {
                    applyEnrichmentToRow(cardRow, cardId, existingEmail, existingPhone, csrfToken);
                    if (extraRow) extraRow.style.display = "none";
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

                    // if (!data.success) {
                    //     if (loader) loader.style.display = "none";
                    //     showMessage(data.error || "Something went wrong.", "error");
                    //     return;
                    // }

                    if (!data.success) {
                        if (loader) loader.style.display = "none";
                        if (data.limit_reached && typeof slShowModal === "function") {
                            slShowModal(data.credits || 0);
                        } else {
                            showMessage(data.error || "Something went wrong.", "error");
                        }
                        return;
                    }
                    // ── Webhook/polling flow ──
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

                                if (checkData.limit_reached) {
                                    if (loader) loader.style.display = "none";
                                    if (typeof slShowModal === "function") slShowModal(checkData.credits || 0);
                                    return;
                                }
                            } catch (pollErr) {
                                console.warn("[Enrich poll] fetch error:", pollErr);
                                continue;
                            }

                            if (checkData.limit_reached) {
                                if (loader) loader.style.display = "none";
                                if (typeof slShowModal === "function") slShowModal(checkData.credits || 0);
                                return;
                            }

                            if (!checkData.pending) {
                                const existingEmail = rowCheckbox ? (rowCheckbox.getAttribute("data-email") || "") : "";
                                const existingPhone = rowCheckbox ? (rowCheckbox.getAttribute("data-phone") || "") : "";
                                const fe = checkData.email || existingEmail;
                                const fp = checkData.phone || existingPhone;

                                // Update checkbox data attributes
                                if (rowCheckbox) {
                                    if (fe) rowCheckbox.setAttribute("data-email", fe);
                                    if (fp) rowCheckbox.setAttribute("data-phone", fp);
                                }

                                // Update DOM cells directly
                                applyEnrichmentToRow(cardRow, cardId, fe, fp, getCookie("csrftoken"));

                                if (extraRow) extraRow.style.display = "none";
                                if (loader) loader.style.display = "none";

                                // ── Update credit pill live ──
                                if (typeof checkData.credits === "number" && typeof slUpdatePill === "function") {
                                    slUpdatePill(checkData.credits);
                                }

                                if (!fe && !fp) {
                                    showMessage("No contact info found for this person.", "error");
                                } else {
                                    showMessage("Contact info fetched successfully!", "success");
                                }

                                resolved = true;
                                break;
                            }
                        }

                        if (loader) loader.style.display = "none";

                        if (!resolved) {
                            showMessage("Enrichment is taking longer than expected. Please try again later.", "error");
                        }
                        return;
                    }

                    // ── Legacy / direct response (no webhook) ──
                    if (loader) loader.style.display = "none";

                    const person = data.person || {};
                    const firstEmail = getFirstEmail(person);
                    const firstPhone = getFirstPhone(person);

                    const finalEmail = firstEmail || existingEmail;
                    const finalPhone = firstPhone || existingPhone;

                    if (rowCheckbox) {
                        rowCheckbox.setAttribute("data-first",               person.first || "");
                        rowCheckbox.setAttribute("data-last",                person.last || "");
                        rowCheckbox.setAttribute("data-linkedin",            person.linkedin || "");
                        rowCheckbox.setAttribute("data-company",             person.company || "");
                        rowCheckbox.setAttribute("data-company_website",     person.company_website || "");
                        rowCheckbox.setAttribute("data-job_title",           person.job_title || "");
                        rowCheckbox.setAttribute("data-institution",         person.institution || "");
                        rowCheckbox.setAttribute("data-location",            person.location || "");
                        rowCheckbox.setAttribute("data-company_headquarter", person.company_headquarter || "");
                        rowCheckbox.setAttribute("data-email",               finalEmail);
                        rowCheckbox.setAttribute("data-phone",               finalPhone);
                    }

                    applyEnrichmentToRow(cardRow, cardId, finalEmail, finalPhone, csrfToken);
                    if (extraRow) extraRow.style.display = "none";

                } catch (error) {
                    if (loader) loader.style.display = "none";
                    showMessage("Server error while fetching contact.", "error");
                    console.error(error);
                }
            });
        });
    }

    setTab("new");
    updateSelectionUI();
    attachEnrichEvents();

    // ── Global Tooltip Logic ──
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
        let top  = rect.bottom + window.scrollY + 6;
        let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipEl.offsetWidth / 2);
        if (left < 10) left = 10;
        if (left + tooltipEl.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltipEl.offsetWidth - 10;
        }
        tooltipEl.style.top  = top + "px";
        tooltipEl.style.left = left + "px";
    });

    document.addEventListener("mouseout", function (e) {
        if (e.target.closest("[data-tooltip]")) tooltipEl.classList.remove("visible");
    });

    window.addEventListener("scroll", function () { tooltipEl.classList.remove("visible"); });

    // ── Single row Save to List button ──
    document.addEventListener("click", function (e) {
        const singleSaveBtn = e.target.closest(".single-save-btn");
        if (!singleSaveBtn) return;

        document.querySelectorAll(".row-checkbox").forEach(function (cb) { cb.checked = false; });
        const selectAll = document.getElementById("selectAllRows");
        if (selectAll) selectAll.checked = false;

        const row = singleSaveBtn.closest("tr");
        if (row) {
            const cb = row.querySelector(".row-checkbox");
            if (cb) cb.checked = true;
        }

        updateSelectionUI();
        const btn = document.getElementById("saveToListBtn");
        if (btn) btn.click();
    });

    // ── Mobile Filter Toggle ──
    const mobileFilterBtn = document.getElementById("mobileFilterBtn");
    const filtersPanel = document.querySelector(".filters-panel");
    const mobileOverlay = document.createElement("div");
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
            filtersPanel.style.setProperty("position",   "fixed",    "important");
            filtersPanel.style.setProperty("left",       "0",        "important");
            filtersPanel.style.setProperty("top",        "0",        "important");
            filtersPanel.style.setProperty("width",      "300px",    "important");
            filtersPanel.style.setProperty("height",     "100vh",    "important");
            filtersPanel.style.setProperty("min-height", "100vh",    "important");
            filtersPanel.style.setProperty("overflow-y", "auto",     "important");
            filtersPanel.style.setProperty("padding",    "0.75rem",  "important");
            filtersPanel.style.setProperty("z-index",    "9500",     "important");
            filtersPanel.style.setProperty("max-height", "none",     "important");
            mobileFilterBtn.innerHTML = '<i class="fas fa-times"></i> Close';
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
            mobileFilterBtn.innerHTML = '<i class="fas fa-filter"></i> Filters';
            mobileOverlay.classList.remove("show");
            document.body.style.overflow = "";
        }

        mobileFilterBtn.addEventListener("click", function () {
            if (filterOpen) { closeFilter(); } else { openFilter(); }
        });
        mobileOverlay.addEventListener("click", function () { closeFilter(); });
    }

    // ══════════════════════════════════════
    //  PROFILE DRAWER
    // ══════════════════════════════════════
    (function initProfileDrawer() {
        const drawer        = document.getElementById("profileDrawer");
        const overlay       = document.getElementById("profileDrawerOverlay");
        const closeBtn      = document.getElementById("closeProfileDrawer");
        const saveBtn       = document.getElementById("drawerSaveToListBtn");
        const drawerContent = document.getElementById("profileDrawerContent");

        if (!drawer || !overlay || !drawerContent) return;

        let currentPersonIdx = null;

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
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });

        if (saveBtn) {
            saveBtn.addEventListener("click", async function () {
                if (currentPersonIdx === null) return;
                document.querySelectorAll(".row-checkbox").forEach(function (cb) { cb.checked = false; });
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

        // ── Drawer "Enrich email" button ──
        drawerContent.addEventListener("click", async function (e) {
            const unlockBtn = e.target.closest(".drawer-unlock-link");
            if (!unlockBtn) return;
            if (currentPersonIdx === null) return;

            const row = document.getElementById("person-card-" + currentPersonIdx);
            if (!row) return;
            const cb = row.querySelector(".row-checkbox");
            if (!cb) return;

            const origText = unlockBtn.textContent;
            unlockBtn.textContent = "Fetching…";
            unlockBtn.disabled = true;

            const formData = new FormData();
            formData.append("csrfmiddlewaretoken",  getCookie("csrftoken"));
            formData.append("linkedin_url",          cb.getAttribute("data-linkedin")            || "");
            formData.append("first",                 cb.getAttribute("data-first")               || "");
            formData.append("last",                  cb.getAttribute("data-last")                || "");
            formData.append("company",               cb.getAttribute("data-company")             || "");
            formData.append("company_website",       cb.getAttribute("data-company_website")     || "");
            formData.append("job_title",             cb.getAttribute("data-job_title")           || "");
            formData.append("institution",           cb.getAttribute("data-institution")         || "");
            formData.append("location",              cb.getAttribute("data-location")            || "");
            formData.append("company_headquarter",   cb.getAttribute("data-company_headquarter") || "");
            formData.append("card_id",               currentPersonIdx);
            formData.append("enrich_type",           "email");

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
                    if (data.limit_reached && typeof slShowModal === "function") {
                        slShowModal(data.credits || 0);
                    } else {
                        showMessage(data.error || "Could not fetch email.", "error");
                    }
                    unlockBtn.textContent = origText;
                    unlockBtn.disabled = false;
                    return;
                }
                let firstEmail = "";

                // ── Webhook polling ──
                if (data.pending && data.request_id) {
                    const requestId = data.request_id;
                    unlockBtn.textContent = "Waiting…";
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
                            console.warn("[Drawer poll] fetch error:", pollErr);
                            continue;
                        }
                        if (checkData.limit_reached) {
                            if (typeof slShowModal === "function") slShowModal(checkData.credits || 0);
                            unlockBtn.textContent = origText;
                            unlockBtn.disabled = false;
                            return;
                        }

                        if (!checkData.pending) {
                            firstEmail = checkData.email || "";
                            // ── Update credit pill live ──
                            if (typeof checkData.credits === "number" && typeof slUpdatePill === "function") {
                                slUpdatePill(checkData.credits);
                            }
                            resolved = true;
                            break;
                        }
                    }

                    if (!resolved) {
                        showMessage("Enrichment timed out. Please try again.", "error");
                        unlockBtn.textContent = origText;
                        unlockBtn.disabled = false;
                        return;
                    }
                } else {
                    // Legacy direct result
                    const person = data.person || {};
                    const emails = person.emails || [];
                    firstEmail = typeof emails[0] === "string"
                        ? emails[0]
                        : (emails[0] && emails[0].email ? emails[0].email : "");
                    if (!firstEmail) firstEmail = data.email || "";
                }

                if (!firstEmail) {
                    showMessage("No email found for this person.", "error");
                    unlockBtn.textContent = origText;
                    unlockBtn.disabled = false;
                    return;
                }

                // 1. Update row checkbox
                cb.setAttribute("data-email", firstEmail);

                // 2. Update the table cells for this row
                applyEnrichmentToRowFromDrawer(row, currentPersonIdx, firstEmail, getCookie("csrftoken"));

                // 3. Update the live contact row inside the drawer
                const contactRow = unlockBtn.closest(".drawer-contact-row");
                if (contactRow) {
                    const contactLeft = contactRow.querySelector(".drawer-contact-left");
                    if (contactLeft) {
                        contactLeft.innerHTML =
                            '<i class="far fa-envelope"></i> <span class="contact-val">' + escapeHtml(firstEmail) + '</span>';
                    }
                    unlockBtn.remove();
                }

                // 4. Replace disabled Send Email button with working form in drawer
                const existingSendBtn = drawerContent.querySelector(".drawer-action-btn.primary");
                if (existingSendBtn) {
                    const actionsDiv = existingSendBtn.closest(".drawer-actions");
                    if (actionsDiv) {
                        const csrfToken = getCookie("csrftoken");
                        const form = document.createElement("form");
                        form.method    = "POST";
                        form.action    = SELECT_PERSON_FOR_EMAIL_URL;
                        form.className = "d-inline";
                        form.style.flex = "1";
                        form.innerHTML =
                            '<input type="hidden" name="csrfmiddlewaretoken" value="' + escapeHtml(csrfToken) + '">'
                            + '<input type="hidden" name="first"               value="' + escapeHtml(cb.getAttribute("data-first") || "") + '">'
                            + '<input type="hidden" name="last"                value="' + escapeHtml(cb.getAttribute("data-last") || "") + '">'
                            + '<input type="hidden" name="linkedin"            value="' + escapeHtml(cb.getAttribute("data-linkedin") || "") + '">'
                            + '<input type="hidden" name="company"             value="' + escapeHtml(cb.getAttribute("data-company") || "") + '">'
                            + '<input type="hidden" name="company_website"     value="' + escapeHtml(cb.getAttribute("data-company_website") || "") + '">'
                            + '<input type="hidden" name="job_title"           value="' + escapeHtml(cb.getAttribute("data-job_title") || "") + '">'
                            + '<input type="hidden" name="institution"         value="' + escapeHtml(cb.getAttribute("data-institution") || "") + '">'
                            + '<input type="hidden" name="location"            value="' + escapeHtml(cb.getAttribute("data-location") || "") + '">'
                            + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(cb.getAttribute("data-company_headquarter") || "") + '">'
                            + '<input type="hidden" name="email"               value="' + escapeHtml(firstEmail) + '">'
                            + '<button type="submit" class="drawer-action-btn primary" style="width:100%;">'
                            + '<i class="far fa-envelope"></i> Send Email</button>';
                        existingSendBtn.replaceWith(form);
                    }
                }

                // 5. Update pre-rendered profile template so re-opening the drawer shows email
                const profileTpl = document.getElementById("person-profile-" + currentPersonIdx);
                if (profileTpl) {
                    const blurredEl = profileTpl.querySelector(".contact-blurred");
                    if (blurredEl) {
                        blurredEl.className   = "contact-val";
                        blurredEl.textContent = firstEmail;
                    }
                    const tplUnlock = profileTpl.querySelector(".drawer-unlock-link");
                    if (tplUnlock) tplUnlock.remove();

                    const tplSendBtn = profileTpl.querySelector(".drawer-action-btn.primary");
                    if (tplSendBtn) {
                        const csrfToken = getCookie("csrftoken");
                        const tplForm = document.createElement("form");
                        tplForm.method    = "POST";
                        tplForm.action    = SELECT_PERSON_FOR_EMAIL_URL;
                        tplForm.className = "d-inline";
                        tplForm.style.flex = "1";
                        tplForm.innerHTML =
                            '<input type="hidden" name="csrfmiddlewaretoken" value="' + escapeHtml(csrfToken) + '">'
                            + '<input type="hidden" name="first"               value="' + escapeHtml(cb.getAttribute("data-first") || "") + '">'
                            + '<input type="hidden" name="last"                value="' + escapeHtml(cb.getAttribute("data-last") || "") + '">'
                            + '<input type="hidden" name="linkedin"            value="' + escapeHtml(cb.getAttribute("data-linkedin") || "") + '">'
                            + '<input type="hidden" name="company"             value="' + escapeHtml(cb.getAttribute("data-company") || "") + '">'
                            + '<input type="hidden" name="company_website"     value="' + escapeHtml(cb.getAttribute("data-company_website") || "") + '">'
                            + '<input type="hidden" name="job_title"           value="' + escapeHtml(cb.getAttribute("data-job_title") || "") + '">'
                            + '<input type="hidden" name="institution"         value="' + escapeHtml(cb.getAttribute("data-institution") || "") + '">'
                            + '<input type="hidden" name="location"            value="' + escapeHtml(cb.getAttribute("data-location") || "") + '">'
                            + '<input type="hidden" name="company_headquarter" value="' + escapeHtml(cb.getAttribute("data-company_headquarter") || "") + '">'
                            + '<input type="hidden" name="email"               value="' + escapeHtml(firstEmail) + '">'
                            + '<button type="submit" class="drawer-action-btn primary" style="width:100%;">'
                            + '<i class="far fa-envelope"></i> Send Email</button>';
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

        // ── Helper: update table row cells from drawer context ──
        function applyEnrichmentToRowFromDrawer(cardRow, cardId, email, csrfToken) {
            if (email) {
                const emailColCell = document.querySelector(".email-col-" + cardId);
                if (emailColCell) {
                    emailColCell.innerHTML =
                        '<span class="contact-col-pill contact-col-email">'
                        + '<i class="far fa-envelope me-1"></i>'
                        + escapeHtml(email)
                        + '</span>';
                }

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
        }

        // ── Click on drawer-trigger cells ──
        document.addEventListener("click", function (e) {
            const trigger = e.target.closest(".drawer-trigger");
            if (!trigger) return;
            if (e.target.closest("a")) return;

            const row = trigger.closest("tr");
            if (!row) return;

            const rowId = row.id || "";
            const personIdx = rowId.replace("person-card-", "");
            if (!personIdx) return;

            const profileTpl = document.getElementById("person-profile-" + personIdx);
            if (!profileTpl) return;

            drawerContent.innerHTML = profileTpl.innerHTML;
            currentPersonIdx = personIdx;
            openDrawer();
        });

    })();

});