document.addEventListener("DOMContentLoaded", function () {

    // ══ Helpers ══
    function esc(v) {
        if (v === null || v === undefined) return "";
        return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function getCookie(name) {
        let val = null;
        if (document.cookie) {
            document.cookie.split(";").forEach(function(c) {
                c = c.trim();
                if (c.startsWith(name + "=")) val = decodeURIComponent(c.slice(name.length + 1));
            });
        }
        return val;
    }

    // ══ Toast ══
    const customMessage    = document.getElementById("customMessage");
    const customMessageText = document.getElementById("customMessageText");
    const closeCustomMessage = document.getElementById("closeCustomMessage");
    let msgTimeout;

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

    // ══ Shared: build hidden email form fields ══
    function emailFormFields(person, csrfToken, email) {
        return '<input type="hidden" name="csrfmiddlewaretoken" value="' + esc(csrfToken) + '">'
            + '<input type="hidden" name="first"               value="' + esc(person.first || person['data-first'] || "") + '">'
            + '<input type="hidden" name="last"                value="' + esc(person.last  || person['data-last']  || "") + '">'
            + '<input type="hidden" name="linkedin"            value="' + esc(person.linkedin || person['data-linkedin'] || "") + '">'
            + '<input type="hidden" name="company"             value="' + esc(person.company || person['data-company'] || "") + '">'
            + '<input type="hidden" name="company_website"     value="' + esc(person.company_website || person['data-company_website'] || "") + '">'
            + '<input type="hidden" name="job_title"           value="' + esc(person.job_title || person['data-job_title'] || "") + '">'
            + '<input type="hidden" name="institution"         value="' + esc(person.institution || person['data-institution'] || "") + '">'
            + '<input type="hidden" name="location"            value="' + esc(person.location || person['data-location'] || "") + '">'
            + '<input type="hidden" name="company_headquarter" value="' + esc(person.company_headquarter || person['data-company_headquarter'] || "") + '">'
            + '<input type="hidden" name="email"               value="' + esc(email) + '">';
    }

    function cbData(cb) {
        return {
            first: cb.getAttribute("data-first") || "",
            last: cb.getAttribute("data-last") || "",
            linkedin: cb.getAttribute("data-linkedin") || "",
            company: cb.getAttribute("data-company") || "",
            company_website: cb.getAttribute("data-company_website") || "",
            job_title: cb.getAttribute("data-job_title") || "",
            institution: cb.getAttribute("data-institution") || "",
            location: cb.getAttribute("data-location") || "",
            company_headquarter: cb.getAttribute("data-company_headquarter") || "",
            email: cb.getAttribute("data-email") || "",
            phone: cb.getAttribute("data-phone") || ""
        };
    }

    // ══ Shared: polling enrichment ══
    async function pollEnrichment(requestId, onDone, onFail) {
        for (let i = 0; i < 40; i++) {
            await new Promise(function(r) { setTimeout(r, 3000); });
            let checkData;
            try {
                const res = await fetch(CHECK_ENRICHMENT_URL.replace("PLACEHOLDER", requestId), {
                    headers: { "X-Requested-With": "XMLHttpRequest" }
                });
                checkData = await res.json();
            } catch(e) { continue; }

            if (checkData.limit_reached) {
                if (typeof slShowModal === "function") slShowModal(checkData.credits || 0);
                return;
            }
            if (typeof checkData.credits === "number" && typeof slUpdatePill === "function") {
                slUpdatePill(checkData.credits);
            }
            if (!checkData.pending) { onDone(checkData); return; }
        }
        onFail();
    }

    // ══ Shared: apply enrichment to a row ══
    function applyEnrichmentToRow(cardRow, cardId, email, phone, csrfToken) {
        if (email) {
            const ec = document.querySelector(".email-col-" + cardId);
            if (ec) ec.innerHTML = '<span class="contact-col-pill contact-col-email"><i class="far fa-envelope me-1"></i>' + esc(email) + '</span>';

            const actionTd = cardRow.querySelector(".action-icons");
            if (actionTd) {
                const inp = actionTd.querySelector('.enrich-form input[name="enrich_type"][value="email"]');
                if (inp) {
                    const oldForm = inp.closest("form");
                    if (oldForm) {
                        const cb = cardRow.querySelector(".row-checkbox");
                        const person = cb ? cbData(cb) : {};
                        const newForm = document.createElement("form");
                        newForm.method = "POST";
                        newForm.action = SELECT_PERSON_FOR_EMAIL_URL;
                        newForm.className = "d-inline";
                        newForm.innerHTML = emailFormFields(person, csrfToken, email)
                            + '<button type="submit" class="send-email-col-btn" title="Send Email"><i class="far fa-envelope me-1"></i> Send Email</button>';
                        oldForm.replaceWith(newForm);
                    }
                }
            }
        }

        if (phone) {
            const pc = document.querySelector(".phone-col-" + cardId);
            if (pc) pc.innerHTML = '<span class="contact-col-pill contact-col-phone"><i class="fas fa-phone-alt me-1" style="font-size:10px;"></i>' + esc(phone) + '</span>';
        }

        // Sync drawer template
        const profileTpl = document.getElementById("person-profile-" + cardId);
        if (profileTpl) {
            const cb = cardRow.querySelector(".row-checkbox");
            const person = cb ? cbData(cb) : {};

            if (email) {
                const rows = profileTpl.querySelectorAll(".drawer-contact-row");
                if (rows[0]) {
                    const blurred = rows[0].querySelector(".contact-blurred");
                    if (blurred) { blurred.className = "contact-val"; blurred.textContent = email; }
                    const unlock = rows[0].querySelector(".drawer-unlock-link");
                    if (unlock) unlock.remove();
                }
                const tplBtn = profileTpl.querySelector(".drawer-action-btn.primary");
                if (tplBtn && tplBtn.disabled) {
                    const tplForm = document.createElement("form");
                    tplForm.method = "POST";
                    tplForm.action = SELECT_PERSON_FOR_EMAIL_URL;
                    tplForm.className = "d-inline";
                    tplForm.style.flex = "1";
                    tplForm.innerHTML = emailFormFields(person, csrfToken, email)
                        + '<button type="submit" class="drawer-action-btn primary" style="width:100%;"><i class="far fa-envelope"></i> Send Email</button>';
                    tplBtn.replaceWith(tplForm);
                }
            }
            if (phone) {
                const rows = profileTpl.querySelectorAll(".drawer-contact-row");
                if (rows[1]) {
                    const blurred = rows[1].querySelector(".contact-blurred");
                    if (blurred) { blurred.className = "contact-val"; blurred.textContent = phone; }
                    const unlock = rows[1].querySelector(".drawer-unlock-link");
                    if (unlock) unlock.remove();
                }
            }
        }
    }

    // ══ Filter toggles ══
    document.querySelectorAll(".filter-toggle").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const p = btn.closest(".filter-item");
            if (p) p.classList.toggle("active");
        });
    });

    // ══ Tag inputs ══
    const tagInputInstances = [];

    function setupTagInput(cfg) {
        const input  = document.getElementById(cfg.inputId);
        const addBtn = document.getElementById(cfg.addBtnId);
        const container = document.getElementById(cfg.tagsContainerId);
        const hidden = document.getElementById(cfg.hiddenInputId);
        if (!input || !addBtn || !container || !hidden) return;

        let tags = hidden.value.trim()
            ? hidden.value.split(",").map(function(t){ return t.trim(); }).filter(Boolean)
            : [];

        function sync() { hidden.value = tags.join(","); }

        function render() {
            container.innerHTML = "";
            tags.forEach(function(t, i) {
                const tag = document.createElement("div");
                tag.className = "tag";
                tag.innerHTML = '<span class="tag-text">' + esc(t) + '</span>'
                    + '<span class="tag-remove" data-index="' + i + '">&times;</span>';
                container.appendChild(tag);
            });
            container.querySelectorAll(".tag-remove").forEach(function(btn) {
                btn.addEventListener("click", function() {
                    tags.splice(parseInt(btn.getAttribute("data-index"), 10), 1);
                    sync(); render();
                });
            });
        }

        function addTag(val) {
            const v = (val !== undefined ? val : input.value).trim();
            if (!v) return;
            if (tags.some(function(t){ return t.toLowerCase() === v.toLowerCase(); })) { input.value = ""; return; }
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
            if (e.key === "Backspace" && !input.value.trim() && tags.length) {
                tags.pop(); sync(); render();
            }
        });

        render(); sync();
        tagInputInstances.push({ finalizePendingInput: function() { if (input.value.trim()) addTag(); } });
    }

    [
        { inputId:"nameInput",        addBtnId:"addNameTag",        tagsContainerId:"nameTags",        hiddenInputId:"nameHidden" },
        { inputId:"locationInput",    addBtnId:"addLocationTag",    tagsContainerId:"locationTags",    hiddenInputId:"locationHidden" },
        { inputId:"companyInput",     addBtnId:"addCompanyTag",     tagsContainerId:"companyTags",     hiddenInputId:"companyHidden" },
        { inputId:"specialitesInput", addBtnId:"addSpecialitesTag", tagsContainerId:"specialitesTags", hiddenInputId:"specialitesHidden" },
        { inputId:"industryInput",    addBtnId:"addIndustryTag",    tagsContainerId:"industryTags",    hiddenInputId:"industryHidden" },
        { inputId:"jobTitleInput",    addBtnId:"addJobTitleTag",    tagsContainerId:"jobTitleTags",    hiddenInputId:"jobTitleHidden" },
        { inputId:"skillsInput",      addBtnId:"addSkillsTag",      tagsContainerId:"skillsTags",      hiddenInputId:"skillsHidden" },
        { inputId:"institutionInput", addBtnId:"addInstitutionTag", tagsContainerId:"institutionTags", hiddenInputId:"institutionHidden" },
        { inputId:"degreeInput",      addBtnId:"addDegreeTag",      tagsContainerId:"degreeTags",      hiddenInputId:"degreeHidden" }
    ].forEach(setupTagInput);

    // ══ Search loader ══
    const searchLoaderOverlay = document.getElementById("searchLoaderOverlay");
    function showSearchLoader() { if (searchLoaderOverlay) searchLoaderOverlay.classList.add("active"); }
    function hideSearchLoader() { if (searchLoaderOverlay) searchLoaderOverlay.classList.remove("active"); }

    // ══ Build results HTML ══
    function buildResultsHTML(people, pagination) {
        if (!people || !people.length) {
            return '<div class="empty-state-box">'
                + '<div class="empty-state-icon"><i class="fas fa-users-slash"></i></div>'
                + '<div class="empty-state-title">No people found</div>'
                + '<div class="empty-state-subtitle">We couldn\'t find anyone matching your current filters.</div>'
                + '</div>';
        }

        var cur      = (pagination && pagination.current) || 1;
        var total    = (pagination && pagination.total)   || 0;
        var pageSize = people.length;
        var startIdx = (cur - 1) * pageSize + 1;
        var endIdx   = Math.min(startIdx + pageSize - 1, total);

        var html = '<div class="results-card" id="resultsCard">'
            + '<div class="results-meta"><div class="results-meta-left">'
            + '<input type="checkbox" id="selectAllRows">'
            + ' <i class="fas fa-chevron-down" style="font-size:11px;color:#aab0c4;cursor:pointer;"></i>'
            + ' <span id="selectedCountText">0 selected of ' + people.length + ' results</span>'
            + '</div><div class="results-meta-right">'
            + '<span style="font-size:13px;color:#6a7388;margin-right:12px;">' + startIdx + '–' + endIdx + ' of ' + total + '</span>'
            + '<button type="button" id="saveToListBtn" class="save-list-btn" style="display:none;"><i class="fas fa-plus"></i> Save to List</button>'
            + '</div></div>'
            + '<div class="table-wrap"><table class="results-table"><thead><tr>'
            + '<th class="col-chk"></th><th>Profile</th><th>Job Title</th>'
            + '<th>Contact Location</th><th>Company</th><th>HQ Location</th>'
            + '<th>Institution</th><th>LinkedIn URL</th><th>Email</th><th>Contact</th><th>Actions</th>'
            + '</tr></thead><tbody>';

        people.forEach(function(p, i) {
            var idx = i + 1;
            var initials = (p.first || "U").charAt(0) + (p.last || "").charAt(0);
            var richJsonAttr = esc(p.rich_json || "{}");
            var hasEmail = p.emails && p.emails[0] && p.emails[0].email;
            var hasPhone = p.phones && p.phones[0] && p.phones[0].number;
            var email = hasEmail ? p.emails[0].email : "";
            var phone = hasPhone ? p.phones[0].number : "";

            var cbAttrs = ' data-first="' + esc(p.first) + '" data-last="' + esc(p.last) + '"'
                + ' data-linkedin="' + esc(p.linkedin) + '" data-company="' + esc(p.company) + '"'
                + ' data-company_website="' + esc(p.company_website || "") + '" data-job_title="' + esc(p.job_title) + '"'
                + ' data-institution="' + esc(p.institution) + '" data-location="' + esc(p.location) + '"'
                + ' data-company_headquarter="' + esc(p.company_headquarter) + '"'
                + ' data-email="' + esc(email) + '" data-phone="' + esc(phone) + '" data-photo="' + esc(p.photo || "") + '"';

            html += '<tr id="person-card-' + idx + '" data-person="' + richJsonAttr + '">'
                + '<td class="col-chk"><input type="checkbox" class="row-checkbox"' + cbAttrs + '></td>';

            // Profile cell
            var photoHtml = p.photo ? '<img src="' + esc(p.photo) + '" alt="Profile Photo" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'fallback-avatar\');">' : '';
            html += '<td><div class="profile-cell">'
                + (p.linkedin ? '<a href="' + esc(p.linkedin) + '" target="_blank" class="avatar-link">' : '')
                + '<div class="' + (p.photo ? 'avatar-circle' : 'avatar-circle fallback-avatar') + '">' + photoHtml + '<span class="initials">' + esc(initials) + '</span></div>'
                + (p.linkedin ? '</a>' : '')
                + '<div class="profile-info"><span class="profile-name drawer-trigger" data-tooltip="' + esc(p.first + ' ' + p.last) + '">' + esc(p.first + ' ' + p.last) + '</span>'
                + (p.linkedin ? ' <a href="' + esc(p.linkedin) + '" target="_blank" class="li-badge" title="LinkedIn">in</a>' : '')
                + '</div></div></td>';

            // Standard cells
            html += '<td class="cell-truncate drawer-trigger" data-tooltip="' + esc(p.job_title || '') + '">' + esc(p.job_title || "—") + '</td>'
                + '<td class="cell-truncate drawer-trigger"' + (p.location ? ' data-tooltip="' + esc(p.location) + '"' : '') + '>'
                + (p.location ? '<span class="cell-icon"><i class="fas fa-map-marker-alt"></i></span>' + esc(p.location) : '—') + '</td>';

            // Company
            html += '<td class="cell-truncate"' + (p.company ? ' data-tooltip="' + esc(p.company) + '"' : '') + '>';
            if (p.company) {
                html += (p.company_website ? '<a href="' + esc(p.company_website) + '" target="_blank" class="company-link">' : '')
                    + '<span class="cell-icon"><i class="fas fa-building"></i></span>' + esc(p.company)
                    + (p.company_website ? '</a>' : '');
            } else html += '—';
            html += '</td>';

            html += '<td class="cell-truncate drawer-trigger"' + (p.company_headquarter ? ' data-tooltip="' + esc(p.company_headquarter) + '"' : '') + '>'
                + (p.company_headquarter ? '<span class="cell-icon"><i class="fas fa-map-marker-alt"></i></span>' + esc(p.company_headquarter) : '—') + '</td>'
                + '<td class="cell-truncate"' + (p.institution ? ' data-tooltip="' + esc(p.institution) + '"' : '') + '>'
                + (p.institution ? '<span class="cell-icon"><i class="fas fa-graduation-cap"></i></span>' + esc(p.institution) : '—') + '</td>'
                + '<td class="cell-truncate"' + (p.linkedin ? ' data-tooltip="' + esc(p.linkedin) + '"' : '') + '>'
                + (p.linkedin ? '<a href="' + esc(p.linkedin) + '" target="_blank" class="linkedin-url-link"><i class="fab fa-linkedin" style="color:#0a66c2;margin-right:5px;"></i>View Profile</a>' : '—') + '</td>';

            // Email col
            html += '<td class="email-col-' + idx + '" style="min-width:180px;">'
                + (hasEmail ? '<span class="contact-col-pill contact-col-email"><i class="far fa-envelope me-1"></i>' + esc(email) + '</span>'
                           : '<span class="contact-col-blurred">***@*****</span>') + '</td>';

            // Phone col
            html += '<td class="phone-col-' + idx + '" style="min-width:130px;">'
                + (hasPhone ? '<span class="contact-col-pill contact-col-phone"><i class="fas fa-phone-alt me-1" style="font-size:10px;"></i>' + esc(phone) + '</span>'
                            : '<span class="contact-col-blurred">***-****</span>') + '</td>';

            // Actions
            var enrichBase = '<input type="hidden" name="csrfmiddlewaretoken" value="' + CSRF_TOKEN + '">'
                + '<input type="hidden" name="linkedin_url" value="' + esc(p.linkedin) + '">'
                + '<input type="hidden" name="first" value="' + esc(p.first) + '">'
                + '<input type="hidden" name="last" value="' + esc(p.last) + '">'
                + '<input type="hidden" name="company" value="' + esc(p.company) + '">'
                + '<input type="hidden" name="company_website" value="' + esc(p.company_website || "") + '">'
                + '<input type="hidden" name="job_title" value="' + esc(p.job_title) + '">'
                + '<input type="hidden" name="institution" value="' + esc(p.institution) + '">'
                + '<input type="hidden" name="location" value="' + esc(p.location) + '">'
                + '<input type="hidden" name="company_headquarter" value="' + esc(p.company_headquarter) + '">'
                + '<input type="hidden" name="card_id" value="' + idx + '">';

            html += '<td style="min-width:150px;"><div class="action-icons">';
            if (hasEmail) {
                html += '<form method="POST" action="' + SELECT_PERSON_FOR_EMAIL_URL + '" class="d-inline">'
                    + emailFormFields(p, CSRF_TOKEN, email)
                    + '<button type="submit" class="send-email-col-btn" title="Send Email"><i class="far fa-envelope me-1"></i> Send Email</button></form>';
            } else {
                html += '<form method="POST" action="' + ENRICH_PERSON_URL + '" class="enrich-form d-inline">'
                    + enrichBase + '<input type="hidden" name="enrich_type" value="email">'
                    + '<button type="submit" title="Fetch Email"><i class="far fa-envelope"></i></button></form>';
            }
            html += '<form method="POST" action="' + ENRICH_PERSON_URL + '" class="enrich-form d-inline">'
                + enrichBase + '<input type="hidden" name="enrich_type" value="phone">'
                + '<button type="submit" title="Fetch Phone"><i class="fas fa-phone-alt"></i></button></form>'
                + '<button type="button" title="Save to List" class="single-save-btn"><i class="far fa-bookmark"></i></button>'
                + '</div></td></tr>'
                + '<tr class="person-extra-row" id="person-extra-' + idx + '" style="display:none;">'
                + '<td colspan="11" style="background:#fafbfe;padding:0;">'
                + '<div class="person-extra-box" style="padding:16px 18px;"><div class="person-extra-content"></div></div>'
                + '</td></tr>';
        });

        html += '</tbody></table></div>';

        // Pagination
        var totalPages = (pagination && (pagination.total_pages || pagination.last_page)) || 1;
        var hasNext    = pagination && pagination.has_next;

        function buildPageRange(cur, total, win) {
            var pages = [], left = Math.max(1, cur - win), right = Math.min(total, cur + win);
            if (left > 1) { pages.push(1); if (left > 2) pages.push(-1); }
            for (var p = left; p <= right; p++) pages.push(p);
            if (right < total) { if (right < total - 1) pages.push(-1); pages.push(total); }
            return pages;
        }

        var pageRange = (pagination && pagination.page_range) || buildPageRange(cur, totalPages, 2);

        html += '<div class="results-footer"><div class="pagination-wrap">'
            + '<button class="page-btn page-btn-text" type="button"' + (cur <= 1 ? ' disabled' : ' onclick="changePage(1)"') + '>&lt;&lt; First</button>'
            + '<button class="page-btn page-btn-text" type="button"' + (cur <= 1 ? ' disabled' : ' onclick="changePage(' + (cur - 1) + ')"') + '>&lt; Prev</button>';

        pageRange.forEach(function(p) {
            if (p === -1) html += '<span class="page-ellipsis">…</span>';
            else if (p === cur) html += '<button class="page-btn page-num active" type="button">' + p + '</button>';
            else html += '<button class="page-btn page-num" type="button" onclick="changePage(' + p + ')">' + p + '</button>';
        });

        html += '<button class="page-btn page-btn-text" type="button"' + (hasNext ? ' onclick="changePage(' + (cur + 1) + ')"' : ' disabled') + '>Next &gt;</button>'
            + '<button class="page-btn page-btn-text" type="button"' + (cur >= totalPages ? ' disabled' : ' onclick="changePage(' + totalPages + ')"') + '>Last &gt;&gt;</button>'
            + '</div></div></div>';

        return html;
    }

    // ══ Build profile drawer templates ══
    function buildProfileTemplatesHTML(people) {
        var html = '';
        people.forEach(function(p, i) {
            var idx = i + 1;
            var initials = (p.first || "U").charAt(0) + (p.last || "").charAt(0);
            var rich = {};
            try { rich = JSON.parse(p.rich_json || "{}"); } catch(e) {}
            var hasEmail = p.emails && p.emails[0] && p.emails[0].email;
            var hasPhone = p.phones && p.phones[0] && p.phones[0].number;

            html += '<div id="person-profile-' + idx + '" class="person-profile-tpl" style="display:none;" aria-hidden="true">'
                + '<div class="drawer-hero"><div class="drawer-hero-top"><div class="drawer-avatar">';

            if (p.photo) {
                html += '<img src="' + esc(p.photo) + '" alt="' + esc(p.first + ' ' + p.last) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                    + '<span class="drawer-avatar-initials" style="display:none;">' + esc(initials) + '</span>';
            } else {
                html += '<span class="drawer-avatar-initials">' + esc(initials) + '</span>';
            }

            html += '</div><div class="drawer-name-block"><div class="drawer-name">';
            if (p.linkedin) {
                html += '<a href="' + esc(p.linkedin) + '" target="_blank" style="color:inherit;text-decoration:none;">' + esc(p.first + ' ' + p.last) + '</a>'
                    + ' <a href="' + esc(p.linkedin) + '" target="_blank" class="li-badge" title="LinkedIn">in</a>';
            } else html += esc(p.first + ' ' + p.last);
            html += '</div>' + (p.job_title ? '<div class="drawer-job">' + esc(p.job_title) + '</div>' : '') + '</div></div>';

            html += '<div class="drawer-meta-row">'
                + (p.location ? '<div class="drawer-meta-item"><i class="fas fa-map-marker-alt"></i><span>' + esc(p.location) + '</span></div>' : '')
                + (p.company_headquarter ? '<div class="drawer-meta-item"><i class="fas fa-map-pin"></i><span>' + esc(p.company_headquarter) + '</span></div>' : '')
                + (rich.department ? '<div class="drawer-meta-item"><i class="fas fa-sitemap"></i><span>' + esc(rich.department) + '</span></div>' : '')
                + '</div>';

            html += '<div class="drawer-tag-row">'
                + (p.company ? '<span class="drawer-tag"><i class="fas fa-building"></i>' + esc(p.company) + '</span>' : '')
                + (p.institution ? '<span class="drawer-tag"><i class="fas fa-graduation-cap"></i>' + esc(p.institution) + '</span>' : '')
                + (p.linkedin ? '<a href="' + esc(p.linkedin) + '" target="_blank" class="drawer-tag li-tag" style="text-decoration:none;"><i class="fab fa-linkedin-in"></i>LinkedIn</a>' : '')
                + '</div></div>';

            // Contacts section
            html += '<div class="drawer-section"><div class="drawer-section-title">Contacts</div>'
                + '<div class="drawer-contact-row"><div class="drawer-contact-left"><i class="far fa-envelope"></i>'
                + (hasEmail ? '<span class="contact-val">' + esc(p.emails[0].email) + '</span>'
                            : '<span class="contact-blurred">***@***</span><button class="drawer-unlock-link" type="button">Enrich email</button>')
                + '</div></div>'
                + '<div class="drawer-contact-row"><div class="drawer-contact-left"><i class="fas fa-phone-alt" style="font-size:12px;margin-left:1px;"></i>'
                + (hasPhone ? '<span class="contact-val">' + esc(p.phones[0].number) + '</span>'
                            : '<span class="contact-blurred">**-***-***</span><button class="drawer-unlock-link" type="button">Enrich Contact</button>')
                + '</div></div></div>';

            // Experience
            html += '<div class="drawer-section"><div class="drawer-section-title">Work Experience</div>';
            var exps = p.experience || rich.experience || [];
            if (exps.length) {
                exps.forEach(function(exp) {
                    html += '<div class="drawer-exp-item"><div class="drawer-exp-icon"><i class="fas fa-building"></i></div><div class="drawer-exp-body">'
                        + '<div class="drawer-exp-title">' + esc(exp.title || "") + '</div>'
                        + '<div class="drawer-exp-company">' + esc(exp.company || "") + (exp.location ? ' | ' + esc(exp.location) : '') + '</div>'
                        + '</div></div>';
                });
            } else html += '<div class="drawer-no-data">No work experience available</div>';
            html += '</div>';

            // Skills
            html += '<div class="drawer-section"><div class="drawer-section-title">Skills</div>';
            var skills = p.skills_list || rich.skills || [];
            if (skills.length) {
                html += '<div class="drawer-skills-wrap">';
                skills.forEach(function(s) { html += '<span class="drawer-skill-chip">' + esc(s) + '</span>'; });
                html += '</div>';
            } else html += '<div class="drawer-no-data">No skills available</div>';
            html += '</div>';

            // Actions
            html += '<div class="drawer-actions">';
            if (hasEmail) {
                html += '<form method="POST" action="' + SELECT_PERSON_FOR_EMAIL_URL + '" class="d-inline" style="flex:1;">'
                    + emailFormFields(p, CSRF_TOKEN, p.emails[0].email)
                    + '<button type="submit" class="drawer-action-btn primary" style="width:100%;"><i class="far fa-envelope"></i> Send Email</button></form>';
            } else {
                html += '<button class="drawer-action-btn primary" type="button" disabled style="flex:1;opacity:.5;cursor:not-allowed;"><i class="far fa-envelope"></i> Send Email</button>';
            }
            if (p.linkedin) html += '<a href="' + esc(p.linkedin) + '" target="_blank" class="drawer-action-btn secondary" style="flex:1;"><i class="fab fa-linkedin-in"></i> LinkedIn</a>';
            html += '</div></div>';
        });
        return html;
    }

    // ══ Render AJAX results ══
    function renderAjaxResults(data) {
        var resultsContent = document.querySelector(".results-content");
        if (!resultsContent) return;

        document.querySelectorAll(".error-box, .empty-state-box").forEach(function(el) { el.remove(); });
        var oldCard = document.getElementById("resultsCard");
        if (oldCard) oldCard.remove();
        document.querySelectorAll(".person-profile-tpl").forEach(function(el) { el.remove(); });

        var aiPanel = document.getElementById("aiSearchPanel");
        var errBox  = document.getElementById("searchErrorBox");
        if (errBox) errBox.remove();

        if (data.error && !data.people.length) {
            var errDiv = document.createElement("div");
            errDiv.className = "empty-state-box";
            errDiv.id = "searchErrorBox";
            errDiv.innerHTML = '<div class="empty-state-icon"><i class="fas fa-users-slash"></i></div>'
                + '<div class="empty-state-title">No people found</div>'
                + '<div class="empty-state-subtitle">We couldn\'t find anyone matching your current filters.</div>'
                + '<div class="empty-state-tips"><div class="empty-state-tips-title"><i class="fas fa-lightbulb"></i> Try these tips</div>'
                + '<ul><li>Use fewer or broader filters</li><li>Check for spelling mistakes</li>'
                + '<li>Try a different location or job title</li><li>Remove the seniority or industry filter</li></ul></div>';
            resultsContent.insertBefore(errDiv, resultsContent.firstChild);
            if (aiPanel) aiPanel.style.display = "";
            return;
        }

        if (aiPanel) aiPanel.style.display = "none";

        resultsContent.insertAdjacentHTML("beforeend", buildResultsHTML(data.people, data.pagination));

        var resultsPanel = document.querySelector(".results-panel");
        if (resultsPanel) resultsPanel.insertAdjacentHTML("afterend", buildProfileTemplatesHTML(data.people));

        if (typeof slUpdateSearchPill === "function" && typeof data.search_credits === "number") slUpdateSearchPill(data.search_credits);
        if (typeof slUpdatePill === "function" && typeof data.credits === "number") slUpdatePill(data.credits);

        attachEnrichEvents();
        reattachSelectionEvents();
    }

    // ══ Selection events ══
    function reattachSelectionEvents() {
        var checkboxes  = document.querySelectorAll(".row-checkbox");
        var selectAll   = document.getElementById("selectAllRows");
        var countText   = document.getElementById("selectedCountText");
        var saveBtn     = document.getElementById("saveToListBtn");

        function updateUI() {
            if (!countText || !saveBtn) return;
            var checked = document.querySelectorAll(".row-checkbox:checked").length;
            countText.textContent = checked + " selected of " + checkboxes.length + " results";
            saveBtn.style.display = checked > 0 ? "inline-flex" : "none";
            if (selectAll) selectAll.checked = checkboxes.length > 0 && checked === checkboxes.length;
        }

        if (selectAll) {
            selectAll.addEventListener("change", function() {
                checkboxes.forEach(function(cb) { cb.checked = selectAll.checked; });
                updateUI();
            });
        }
        checkboxes.forEach(function(cb) { cb.addEventListener("change", updateUI); });

        if (saveBtn) {
            saveBtn.addEventListener("click", async function() {
                await loadExistingLists(); setTab("new"); openModal();
            });
        }

        var contactPill = document.getElementById("contactPill");
        if (contactPill) contactPill.textContent = "0/" + checkboxes.length;
    }

    // ══ AJAX search ══
    const loader = document.getElementById("enrichLoader");
    const peopleSearchForm = document.getElementById("peopleSearchForm");

    window.doAjaxSearch = function(pageOverride) {
        tagInputInstances.forEach(function(inst) { inst.finalizePendingInput(); });
        var formData = new FormData(peopleSearchForm);
        if (pageOverride) formData.set("page", pageOverride);
        showSearchLoader();
        fetch(SEARCH_PEOPLE_URL, {
            method: "POST",
            headers: { "X-CSRFToken": CSRF_TOKEN, "X-Requested-With": "XMLHttpRequest" },
            body: formData
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            hideSearchLoader();
            if (data.limit_reached) { if (typeof slShowModal === "function") slShowModal(data.credits || 0); return; }
            renderAjaxResults(data);
        })
        .catch(function(err) {
            hideSearchLoader();
            console.error("AJAX search error:", err);
            showMessage("Search failed. Please try again.", "error");
        });
    };

    if (peopleSearchForm) {
        peopleSearchForm.addEventListener("submit", function(e) { e.preventDefault(); window.doAjaxSearch(); });
    }

    // ══ Selection & Modal (initial page load) ══
    const rowCheckboxes  = document.querySelectorAll(".row-checkbox");
    const selectAllRows  = document.getElementById("selectAllRows");
    const selectedCountText = document.getElementById("selectedCountText");
    const saveToListBtn  = document.getElementById("saveToListBtn");
    const saveListModal  = document.getElementById("saveListModal");
    const closeSaveListModal = document.getElementById("closeSaveListModal");
    const cancelSaveListBtn  = document.getElementById("cancelSaveListBtn");
    const confirmSaveListBtn = document.getElementById("confirmSaveListBtn");
    const newListTab     = document.getElementById("newListTab");
    const existingListTab = document.getElementById("existingListTab");
    const newListSection = document.getElementById("newListSection");
    const existingListSection = document.getElementById("existingListSection");
    const newListName    = document.getElementById("newListName");
    const existingListSelect = document.getElementById("existingListSelect");
    let activeListMode   = "new";

    function updateSelectionUI() {
        if (!selectedCountText || !saveToListBtn) return;
        var checked = document.querySelectorAll(".row-checkbox:checked").length;
        selectedCountText.textContent = checked + " selected of " + rowCheckboxes.length + " results";
        saveToListBtn.style.display = checked > 0 ? "inline-flex" : "none";
        if (selectAllRows) selectAllRows.checked = rowCheckboxes.length > 0 && checked === rowCheckboxes.length;
    }

    function collectSelectedPeople() {
        var selected = [];
        document.querySelectorAll(".row-checkbox:checked").forEach(function(cb) { selected.push(cbData(cb)); });
        return selected;
    }

    async function loadExistingLists() {
        if (!existingListSelect) return;
        try {
            var res = await fetch(GET_SAVED_LISTS_URL, { headers: { "X-Requested-With": "XMLHttpRequest" } });
            var data = await res.json();
            existingListSelect.innerHTML = '<option value="">Select a list</option>';
            if (data.success && Array.isArray(data.lists)) {
                data.lists.forEach(function(item) {
                    var opt = document.createElement("option");
                    opt.value = item.id; opt.textContent = item.name;
                    existingListSelect.appendChild(opt);
                });
            }
        } catch(e) { console.error("Failed to load existing lists:", e); }
    }

    function openModal()  { if (saveListModal) saveListModal.style.display = "flex"; }
    function closeModal() {
        if (saveListModal) saveListModal.style.display = "none";
        if (newListName) newListName.value = "";
        if (existingListSelect) existingListSelect.value = "";
        // Reset phone enrichment toggle to OFF
        var phoneCb = document.getElementById("enrichPhoneCheckbox");
        if (phoneCb) { phoneCb.checked = false; updatePhoneToggleUI(); }
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
    if (saveToListBtn)    saveToListBtn.addEventListener("click", async function() { await loadExistingLists(); setTab("new"); openModal(); });
    if (closeSaveListModal) closeSaveListModal.addEventListener("click", closeModal);
    if (cancelSaveListBtn)  cancelSaveListBtn.addEventListener("click", closeModal);
    if (newListTab)      newListTab.addEventListener("click", function() { setTab("new"); });
    if (existingListTab) existingListTab.addEventListener("click", async function() { setTab("existing"); await loadExistingLists(); });

    // ══ Phone enrichment toggle ══
    var enrichPhoneCb     = document.getElementById("enrichPhoneCheckbox");
    var enrichPhoneSwitch = document.getElementById("enrichPhoneSwitch");
    var enrichPhoneKnob   = document.getElementById("enrichPhoneKnob");
    var enrichPhoneLabel  = document.getElementById("enrichPhoneLabel");
    var enrichCreditCost  = document.getElementById("enrichCreditCostText");

    function updatePhoneToggleUI() {
        var isOn = enrichPhoneCb && enrichPhoneCb.checked;
        if (enrichPhoneSwitch) enrichPhoneSwitch.style.background = isOn ? "#7c4fc8" : "#ccd4e1";
        if (enrichPhoneKnob)   enrichPhoneKnob.style.left         = isOn ? "18px"    : "2px";
        if (enrichPhoneLabel)  { enrichPhoneLabel.textContent = isOn ? "On" : "Off"; enrichPhoneLabel.style.color = isOn ? "#7c4fc8" : "#8c93a3"; }
        if (enrichCreditCost)  enrichCreditCost.textContent = isOn ? "4 credits/person (1 email + 3 phone)" : "1 credit/person (email only)";
    }

    var enrichPhoneToggle = document.getElementById("enrichPhoneToggle");
    if (enrichPhoneToggle && enrichPhoneCb) {
        enrichPhoneToggle.addEventListener("click", function() {
            enrichPhoneCb.checked = !enrichPhoneCb.checked;
            updatePhoneToggleUI();
        });
    }

    // ══ Confirm save to list ══
    if (confirmSaveListBtn) {
        confirmSaveListBtn.addEventListener("click", async function() {
            var selectedPeople = collectSelectedPeople();
            if (!selectedPeople.length) { showMessage("Please select at least one person.", "error"); return; }

            var enrichPhone = enrichPhoneCb ? enrichPhoneCb.checked : false;
            var payload = { list_type: activeListMode, people: selectedPeople, enrich_phone: enrichPhone };
            if (activeListMode === "new") {
                var listName = newListName ? newListName.value.trim() : "";
                if (!listName) { showMessage("Please enter a list name.", "error"); return; }
                payload.list_name = listName;
            } else {
                var listId = existingListSelect ? existingListSelect.value : "";
                if (!listId) { showMessage("Please select an existing list.", "error"); return; }
                payload.list_id = listId;
            }

            try {
                confirmSaveListBtn.disabled = true;
                confirmSaveListBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

                var res = await fetch(SAVE_ENRICH_CAMPAIGN_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken"), "X-Requested-With": "XMLHttpRequest" },
                    body: JSON.stringify(payload)
                });
                var data = await res.json();

                if (!data.success) {
                    if (data.limit_reached && typeof slShowModal === "function") slShowModal(data.credits || 0);
                    else showMessage(data.error || "Could not save list.", "error");
                    confirmSaveListBtn.disabled = false;
                    confirmSaveListBtn.innerHTML = "Save to List";
                    return;
                }

                if (!data.pending || !data.request_ids || !data.request_ids.length) {
                    confirmSaveListBtn.innerHTML = "✅ Done! Redirecting...";
                    showMessage(data.message || "Saved successfully.", "success");
                    closeModal();
                    setTimeout(function() { window.location.href = data.redirect_url; }, 1200);
                    return;
                }

                var requestIds  = data.request_ids;
                var redirectUrl = data.redirect_url;
                var total       = requestIds.length;
                closeModal();
                showMessage("Enriching " + total + " contacts\u2026 this may take a moment.", "success");

                var progressBar = document.getElementById("enrichProgressBar");
                if (!progressBar) {
                    progressBar = document.createElement("div");
                    progressBar.id = "enrichProgressBar";
                    progressBar.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#fff;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.15);padding:16px 24px;z-index:99999;min-width:300px;text-align:center;font-size:14px;font-weight:600;color:#2e374d";
                    document.body.appendChild(progressBar);
                }

                function updateProgress(done, tot) {
                    var pct = tot > 0 ? Math.round((done / tot) * 100) : 0;
                    progressBar.innerHTML = '<i class="fas fa-spinner fa-spin me-2" style="color:#6276ea;"></i>Enriching contacts\u2026 ' + done + '/' + tot + ' done'
                        + '<div style="margin-top:10px;height:6px;background:#eef0f4;border-radius:99px;overflow:hidden;">'
                        + '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#6276ea,#7c4fc8);border-radius:99px;transition:width .4s;"></div></div>';
                }

                updateProgress(0, total);
                var allDone = false;

                for (var attempt = 0; attempt < 40; attempt++) {
                    await new Promise(function(r) { setTimeout(r, 3000); });
                    var checkData;
                    try {
                        var pollResp = await fetch(CHECK_BULK_ENRICHMENT_URL + "?request_ids=" + requestIds.join(","), { headers: { "X-Requested-With": "XMLHttpRequest" } });
                        checkData = await pollResp.json();
                    } catch(e) { continue; }

                    if (checkData.limit_reached) {
                        if (progressBar) progressBar.remove();
                        if (typeof slShowModal === "function") slShowModal(checkData.credits || 0);
                        confirmSaveListBtn.disabled = false;
                        confirmSaveListBtn.innerHTML = "Save to List";
                        return;
                    }
                    updateProgress(checkData.done || 0, checkData.total || total);
                    if (typeof checkData.credits === "number" && typeof slUpdatePill === "function") slUpdatePill(checkData.credits);
                    if (checkData.all_done) { allDone = true; break; }
                }

                if (progressBar) progressBar.remove();
                showMessage(allDone ? "Enrichment complete! Redirecting to campaign..." : "Enrichment is still running in background. Redirecting...", "success");
                setTimeout(function() { window.location.href = redirectUrl; }, 1500);

            } catch(e) {
                console.error("Save & enrich error:", e);
                showMessage("Server error while saving list.", "error");
                confirmSaveListBtn.disabled = false;
                confirmSaveListBtn.innerHTML = "Save to List";
            }
        });
    }

    // ══ Enrich events ══
    function attachEnrichEvents() {
        function getFirstEmail(p) {
            if (!p.emails || !p.emails.length) return "";
            return typeof p.emails[0] === "string" ? p.emails[0] : (p.emails[0].email || "");
        }
        function getFirstPhone(p) {
            if (!p.phones || !p.phones.length) return "";
            return typeof p.phones[0] === "string" ? p.phones[0] : (p.phones[0].number || "");
        }

        document.querySelectorAll(".enrich-form").forEach(function(form) {
            form.addEventListener("submit", async function(e) {
                e.preventDefault();
                var formData   = new FormData(form);
                var csrfToken  = (form.querySelector("[name=csrfmiddlewaretoken]") || {}).value || getCookie("csrftoken");
                var cardId     = formData.get("card_id");
                var enrichType = formData.get("enrich_type") || "email";
                var cardRow    = document.getElementById("person-card-" + cardId);
                var extraRow   = document.getElementById("person-extra-" + cardId);
                if (!cardRow) return;

                var cb = cardRow.querySelector(".row-checkbox");
                var existingEmail = cb ? (cb.getAttribute("data-email") || "") : "";
                var existingPhone = cb ? (cb.getAttribute("data-phone") || "") : "";

                if ((enrichType === "email" && existingEmail) || (enrichType === "phone" && existingPhone)) {
                    applyEnrichmentToRow(cardRow, cardId, existingEmail, existingPhone, csrfToken);
                    if (extraRow) extraRow.style.display = "none";
                    return;
                }

                if (loader) loader.style.display = "flex";

                try {
                    var res  = await fetch(form.action || ENRICH_PERSON_URL, {
                        method: "POST",
                        headers: { "X-CSRFToken": csrfToken, "X-Requested-With": "XMLHttpRequest" },
                        body: formData
                    });
                    var data = await res.json();

                    if (!data.success) {
                        if (loader) loader.style.display = "none";
                        if (data.limit_reached && typeof slShowModal === "function") slShowModal(data.credits || 0);
                        else showMessage(data.error || "Something went wrong.", "error");
                        return;
                    }

                    if (data.pending && data.request_id) {
                        await pollEnrichment(data.request_id, function(checkData) {
                            var fe = checkData.email || existingEmail;
                            var fp = checkData.phone || existingPhone;
                            if (cb) { if (fe) cb.setAttribute("data-email", fe); if (fp) cb.setAttribute("data-phone", fp); }
                            applyEnrichmentToRow(cardRow, cardId, fe, fp, getCookie("csrftoken"));
                            if (extraRow) extraRow.style.display = "none";
                            if (loader) loader.style.display = "none";
                            if (!fe && !fp) showMessage("No contact info found for this person.", "error");
                            else showMessage("Contact info fetched successfully!", "success");
                        }, function() {
                            if (loader) loader.style.display = "none";
                            showMessage("Enrichment is taking longer than expected. Please try again later.", "error");
                        });
                        return;
                    }

                    // Legacy direct response
                    if (loader) loader.style.display = "none";
                    var person = data.person || {};
                    var fe = getFirstEmail(person) || existingEmail;
                    var fp = getFirstPhone(person) || existingPhone;
                    if (cb) {
                        Object.entries({
                            "data-first": person.first, "data-last": person.last,
                            "data-linkedin": person.linkedin, "data-company": person.company,
                            "data-company_website": person.company_website, "data-job_title": person.job_title,
                            "data-institution": person.institution, "data-location": person.location,
                            "data-company_headquarter": person.company_headquarter,
                            "data-email": fe, "data-phone": fp
                        }).forEach(function(kv) { if (kv[1]) cb.setAttribute(kv[0], kv[1]); });
                    }
                    applyEnrichmentToRow(cardRow, cardId, fe, fp, csrfToken);
                    if (extraRow) extraRow.style.display = "none";

                } catch(err) {
                    if (loader) loader.style.display = "none";
                    showMessage("Server error while fetching contact.", "error");
                    console.error(err);
                }
            });
        });
    }

    setTab("new"); updateSelectionUI(); attachEnrichEvents();

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

    // ══ Single row save button ══
    document.addEventListener("click", function(e) {
        var btn = e.target.closest(".single-save-btn");
        if (!btn) return;
        document.querySelectorAll(".row-checkbox").forEach(function(cb) { cb.checked = false; });
        var selAll = document.getElementById("selectAllRows");
        if (selAll) selAll.checked = false;
        var row = btn.closest("tr");
        if (row) { var cb = row.querySelector(".row-checkbox"); if (cb) cb.checked = true; }
        updateSelectionUI();
        var savBtn = document.getElementById("saveToListBtn");
        if (savBtn) savBtn.click();
    });

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
    function openFilter() {
        filterOpen = true;
        ["position:fixed","left:0","top:0","width:300px","height:100vh","min-height:100vh","overflow-y:auto","padding:0.75rem","z-index:9500","max-height:none"].forEach(function(s) {
            var kv = s.split(":");
            filtersPanel.style.setProperty(kv[0], kv.slice(1).join(":"), "important");
        });
        mobileFilterBtn.innerHTML = '<i class="fas fa-times"></i> Close';
        mobileOverlay.classList.add("show");
        document.body.style.overflow = "hidden";
    }
    function closeFilter() {
        filterOpen = false;
        ["position","left","top","width","height","min-height","overflow-y","padding","z-index","max-height"].forEach(function(p) { filtersPanel.style.removeProperty(p); });
        mobileFilterBtn.innerHTML = '<i class="fas fa-filter"></i> Filters';
        mobileOverlay.classList.remove("show");
        document.body.style.overflow = "";
    }

    if (mobileFilterBtn && filtersPanel) {
        mobileFilterBtn.addEventListener("click", function() { if (filterOpen) closeFilter(); else openFilter(); });
        mobileOverlay.addEventListener("click", closeFilter);
    }

    // ══ Profile Drawer ══
    (function initProfileDrawer() {
        var drawer        = document.getElementById("profileDrawer");
        var overlay       = document.getElementById("profileDrawerOverlay");
        var closeBtn      = document.getElementById("closeProfileDrawer");
        var saveBtn       = document.getElementById("drawerSaveToListBtn");
        var drawerContent = document.getElementById("profileDrawerContent");
        if (!drawer || !overlay || !drawerContent) return;

        var currentPersonIdx = null;

        function openDrawer()  { overlay.classList.add("active"); drawer.classList.add("open"); document.body.style.overflow = "hidden"; }
        function closeDrawer() {
            overlay.classList.remove("active"); drawer.classList.remove("open");
            document.body.style.overflow = ""; currentPersonIdx = null;
            if (saveBtn) saveBtn.classList.remove("saved");
        }

        if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
        overlay.addEventListener("click", closeDrawer);
        document.addEventListener("keydown", function(e) { if (e.key === "Escape") closeDrawer(); });

        if (saveBtn) {
            saveBtn.addEventListener("click", async function() {
                if (currentPersonIdx === null) return;
                document.querySelectorAll(".row-checkbox").forEach(function(cb) { cb.checked = false; });
                var selAll = document.getElementById("selectAllRows");
                if (selAll) selAll.checked = false;
                var row = document.getElementById("person-card-" + currentPersonIdx);
                if (row) { var cb = row.querySelector(".row-checkbox"); if (cb) cb.checked = true; }
                updateSelectionUI();
                await loadExistingLists(); setTab("new"); openModal();
            });
        }

        // Drawer unlock (enrich email) button
        drawerContent.addEventListener("click", async function(e) {
            var unlockBtn = e.target.closest(".drawer-unlock-link");
            if (!unlockBtn || currentPersonIdx === null) return;
            var row = document.getElementById("person-card-" + currentPersonIdx);
            if (!row) return;
            var cb = row.querySelector(".row-checkbox");
            if (!cb) return;

            var origText = unlockBtn.textContent;
            unlockBtn.textContent = "Fetching…"; unlockBtn.disabled = true;

            var formData = new FormData();
            var person = cbData(cb);
            Object.entries(person).forEach(function(kv) { formData.append(kv[0] === "company_website" ? kv[0] : kv[0], kv[1]); });
            formData.append("csrfmiddlewaretoken", getCookie("csrftoken"));
            formData.append("linkedin_url", cb.getAttribute("data-linkedin") || "");
            formData.append("card_id", currentPersonIdx);
            formData.append("enrich_type", "email");

            try {
                var res  = await fetch(ENRICH_PERSON_URL, {
                    method: "POST",
                    headers: { "X-CSRFToken": getCookie("csrftoken"), "X-Requested-With": "XMLHttpRequest" },
                    body: formData
                });
                var data = await res.json();

                if (!data.success) {
                    if (data.limit_reached && typeof slShowModal === "function") slShowModal(data.credits || 0);
                    else showMessage(data.error || "Could not fetch email.", "error");
                    unlockBtn.textContent = origText; unlockBtn.disabled = false; return;
                }

                var firstEmail = "";

                if (data.pending && data.request_id) {
                    unlockBtn.textContent = "Waiting…";
                    var resolved = false;
                    await pollEnrichment(data.request_id, function(checkData) {
                        firstEmail = checkData.email || ""; resolved = true;
                    }, function() {});

                    if (!resolved || !firstEmail) {
                        showMessage(firstEmail ? "Email fetched!" : "No email found.", firstEmail ? "success" : "error");
                        if (!firstEmail) { unlockBtn.textContent = origText; unlockBtn.disabled = false; return; }
                    }
                } else {
                    var person2 = data.person || {};
                    var emails = person2.emails || [];
                    firstEmail = typeof emails[0] === "string" ? emails[0] : ((emails[0] && emails[0].email) || "");
                    if (!firstEmail) firstEmail = data.email || "";
                }

                if (!firstEmail) {
                    showMessage("No email found for this person.", "error");
                    unlockBtn.textContent = origText; unlockBtn.disabled = false; return;
                }

                cb.setAttribute("data-email", firstEmail);
                applyEnrichmentToRow(row, currentPersonIdx, firstEmail, "", getCookie("csrftoken"));

                // Update live drawer contact row
                var contactRow = unlockBtn.closest(".drawer-contact-row");
                if (contactRow) {
                    var left = contactRow.querySelector(".drawer-contact-left");
                    if (left) left.innerHTML = '<i class="far fa-envelope"></i> <span class="contact-val">' + esc(firstEmail) + '</span>';
                }

                // Replace disabled send button in drawer
                var sendBtn2 = drawerContent.querySelector(".drawer-action-btn.primary");
                if (sendBtn2 && sendBtn2.disabled) {
                    var actionsDiv = sendBtn2.closest(".drawer-actions");
                    if (actionsDiv) {
                        var form2 = document.createElement("form");
                        form2.method = "POST"; form2.action = SELECT_PERSON_FOR_EMAIL_URL;
                        form2.className = "d-inline"; form2.style.flex = "1";
                        form2.innerHTML = emailFormFields(cbData(cb), getCookie("csrftoken"), firstEmail)
                            + '<button type="submit" class="drawer-action-btn primary" style="width:100%;"><i class="far fa-envelope"></i> Send Email</button>';
                        sendBtn2.replaceWith(form2);
                    }
                }

                showMessage("Email fetched successfully!", "success");

            } catch(err) {
                console.error("Drawer enrich error:", err);
                showMessage("Server error while fetching email.", "error");
                unlockBtn.textContent = origText; unlockBtn.disabled = false;
            }
        });

        // Drawer trigger (click on row name/cell)
        document.addEventListener("click", function(e) {
            var trigger = e.target.closest(".drawer-trigger");
            if (!trigger || e.target.closest("a")) return;
            var row = trigger.closest("tr");
            if (!row) return;
            var personIdx = (row.id || "").replace("person-card-", "");
            if (!personIdx) return;
            var profileTpl = document.getElementById("person-profile-" + personIdx);
            if (!profileTpl) return;
            drawerContent.innerHTML = profileTpl.innerHTML;
            currentPersonIdx = personIdx;
            openDrawer();
        });
    })();

});