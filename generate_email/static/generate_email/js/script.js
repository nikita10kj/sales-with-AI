class EmailMarketingApp {
  constructor() {
    this.currentStep = 1
    this.totalSteps = 3
    this.formData = {}
    this.generatedEmails = []
    this.selectedEmails = []
    this.savedAttachmentId = null;
    this.init()
  }

  init() {
    this.bindEvents()
    this.updateStepDisplay()
  }

  bindEvents() {
    // Step navigation from sidebar
    document.querySelectorAll(".step").forEach((step) => {
      step.addEventListener("click", (e) => {
        const stepNumber = Number.parseInt(e.currentTarget.dataset.step)
        this.goToStep(stepNumber)
      })
    })

    // Form submissions
    document.getElementById("targetFrameworkForm").addEventListener("submit", (e) => {
      e.preventDefault()
      console.log("Checking email history and proceeding...");
      app.checkEmailHistoryAndProceed()
    })

    document.getElementById("sendEmail").addEventListener("click", () => {
          this.nextStep()

        this.sendEmail()
    })
    const savedAttachmentSelect = document.getElementById("saved_attachment");
      if (savedAttachmentSelect) {
          savedAttachmentSelect.addEventListener("change", (e) => {
              this.savedAttachmentId = e.target.value || null;
              console.log("Saved attachment selected:", this.savedAttachmentId);

              // If user selects saved file, clear manual upload
              if (this.savedAttachmentId) {
                  this.attachmentFile = null;
              }
          });
}
  }

  nextStep() {
    if (this.validateCurrentStep()) {
      this.saveCurrentStepData()
      if (this.currentStep < this.totalSteps) {
        this.currentStep++
//        this.updateStepDisplay()
      }
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--
      this.updateStepDisplay()
    }
  }

  goToStep(stepNumber) {
    if (stepNumber <= this.currentStep || this.isStepCompleted(stepNumber - 1)) {
      this.currentStep = stepNumber
      this.updateStepDisplay()
    }
  }

  updateStepDisplay() {
    // Update step content visibility
    document.querySelectorAll(".step-content").forEach((content) => {
      content.classList.remove("active")
    })
    document.getElementById(`step-${this.currentStep}`).classList.add("active")

    // Update sidebar steps
    document.querySelectorAll(".step").forEach((step, index) => {
      step.classList.remove("active", "completed")
      if (index + 1 === this.currentStep) {
        step.classList.add("active")
      } else if (index + 1 < this.currentStep) {
        step.classList.add("completed")
      }
    })
  }

  validateCurrentStep() {
    const currentStepElement = document.getElementById(`step-${this.currentStep}`)
    const requiredFields = currentStepElement.querySelectorAll("[required]")
    let isValid = true

    requiredFields.forEach((field) => {
      if (!field.value.trim()) {
        field.classList.add("is-invalid")
        isValid = false
      } else {
        field.classList.remove("is-invalid")
      }
    })

    if (!isValid) {
      this.showAlert("Please fill in all required fields.", "warning")
    }

    return isValid
  }

  saveCurrentStepData() {
    const currentStepElement = document.getElementById(`step-${this.currentStep}`)
    const formElements = currentStepElement.querySelectorAll("input, select, textarea")

    formElements.forEach((element) => {
      if (element.type === "radio") {
        if (element.checked) {
          this.formData[element.name] = element.value
        }
      } else if (element.type === "file") {
        this.formData[element.name] = element.files
      } else {
        this.formData[element.name] = element.value
      }
    })
  }

  isStepCompleted(stepNumber) {
    // Logic to check if a step has been completed
    return stepNumber < this.currentStep
  }

  async submitForm() {
    this.showLoading(true);
    try {
      const response = await fetch('/generator/generate_email/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCSRFToken(), // Include CSRF token if needed
        },
        body: JSON.stringify(this.formData),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        // If the server returned a specific error message, show it
        const errorMessage = data.errors || 'Error submitting details. Please try again.';
        this.showAlert(errorMessage, 'danger');
        return;
      }
      this.updateStepDisplay()
      this.generatedEmails = data.emails; // Assuming the response contains the generated emails
      this.targetId = data.targetId;
      this.displayGeneratedEmails();
      this.showAlert("Details submitted successfully!", "success");
    } catch (error) {
    console.log("submit error:", error)
      this.showAlert("Error submitting details. Please try again.", "danger");
    } finally {
      this.showLoading(false);
    }
  }

  displayGeneratedEmails() {
    const container = document.getElementById("emailsContainer")
    container.innerHTML = ""
    // Main email
      if (this.generatedEmails && this.generatedEmails.main_email) {
        const main = this.generatedEmails.main_email;
        const mainCard = document.createElement("div");
        mainCard.className = "email-card";
        mainCard.dataset.emailId = "main_email"; // <-- Assign emailId here
        mainCard.innerHTML = `
          <div class="email-header">
              <h5 class="email-title">${main.title}</h5>
              <div class="email-actions">
                  <button class="btn btn-sm btn-outline-primary" onclick="app.editEmail(this)">
                      <i class="fas fa-edit"></i> Edit
                  </button>
              </div>
          </div>
          <div class="email-body">
              <div class="email-subject">
                  <strong>Subject:</strong> ${main.subject}
              </div>
              <div class="email-content">
                  ${main.body}                      
                  ${this.renderAttachmentPreview()}
              </div>
          </div>
        `;
        container.appendChild(mainCard);
      }
    this.generatedEmails.follow_ups.forEach((email, index) => {
      const emailCard = this.createEmailCard(email, index + 1)
      container.appendChild(emailCard)
    })
  }

  createEmailCard(email, count) {
  const defaultDays = [3, 5, 7, 10];
  const defaultDay = defaultDays[count - 1] || 3; // default if more than 4 follow-ups
  const card = document.createElement("div");
  card.className = "email-card";
  card.dataset.emailId = `follow_up_${count - 1}`;

  // Build dropdown options for 1–60 days
  let optionsHtml = "";
  for (let i = 1; i <= 60; i++) {
    optionsHtml += `<option value="${i}" ${i === defaultDay ? "selected" : ""}>${i} days</option>`;
  }

  card.innerHTML = `
    <div class="email-header d-flex justify-content-between align-items-center">
        <h5 class="email-title">Follow Up Email - ${count}</h5>
        <div class="email-actions">
            <button class="btn btn-sm btn-outline-primary" onclick="app.editEmail(this)">
                <i class="fas fa-edit"></i> Edit
            </button>
        </div>
    </div>
    <div class="email-body">
        <div class="mb-3">
            <label class="form-label">Send Reminder After:</label>
            <select class="form-select reminder-day-select" data-index="${count - 1}">
                ${optionsHtml}
            </select>
        </div>
        <div class="email-content">
            ${email.body}
            ${this.renderAttachmentPreview()}
        </div>
    </div>
  `;
  return card;
}
  editEmail(button) {
      const card = button.closest('.email-card');
      const emailKey = card.dataset.emailId;

      let email;
      if (emailKey === 'main_email') {
        email = this.generatedEmails.main_email;
        if (email) {
          const modal = new bootstrap.Modal(document.getElementById("emailPreviewModal"))
          document.getElementById("emailPreviewContent").innerHTML = `
                    <div class="mb-3">
                        <label class="form-label">Subject Line</label>
                        <input type="text" class="form-control" id="editSubject" value="${email.subject}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email Body</label>
                         <div id="editBody" contenteditable="true" class="form-control" style="min-height: 200px; ">
                           ${email.body}
                         </div>
                    </div>
                `
          document.getElementById("saveEmailChanges").onclick = () => {
            email.subject = document.getElementById("editSubject").value
            email.body = document.getElementById("editBody").innerHTML
            this.displayGeneratedEmails()
            modal.hide()
            this.showAlert("Email updated successfully!", "success")
          }
          modal.show()
        }
      } else if (emailKey.startsWith('follow_up_')) {
        const index = parseInt(emailKey.split('_')[2]); // e.g. 'follow_up_0'
        email = this.generatedEmails.follow_ups[index];
        if (email) {
          const modal = new bootstrap.Modal(document.getElementById("emailPreviewModal"))
          document.getElementById("emailPreviewContent").innerHTML = `
                    <div class="mb-3">
                        <label class="form-label">Email Body</label>
                         <div id="editBody" contenteditable="true" class="form-control" style="min-height: 200px; ">
                           ${email.body}
                         </div>
                    </div>
                `
          document.getElementById("saveEmailChanges").onclick = () => {
            email.body = document.getElementById("editBody").innerHTML
            this.displayGeneratedEmails()
            modal.hide()
            this.showAlert("Email updated successfully!", "success")
          }
          modal.show()
        }
      }
  }

  async sendEmail() {
    // Show loading indicator while sending
    this.showLoading(true, "Sending Email...");
    const emails = this.generatedEmails;
    const sentFrom = document.querySelector('select[name="sent_from"]')?.value;
    if (!sentFrom) {
      this.showAlert("Please select a sending account.", "warning");
      this.showLoading(false);
      return;
    }
    // collect selected days from dropdowns
    const daySelects = document.querySelectorAll(".reminder-day-select");
    daySelects.forEach(select => {
      const index = parseInt(select.dataset.index);
      const selectedDay = parseInt(select.value);
      if (emails.follow_ups[index]) {
        emails.follow_ups[index].day = selectedDay;  // attach day to each follow-up
      }
    });

        let response;
        // ✅ IF ATTACHMENT EXISTS → USE FormData
       if (this.savedAttachmentId) {
          const formData = new FormData();
          formData.append("emails", JSON.stringify(emails));
          formData.append("targetId", this.targetId);
          formData.append("sent_from", sentFrom);
          formData.append("saved_attachment_id", this.savedAttachmentId);

          response = await fetch("/generator/send_email/", {
              method: "POST",
              headers: {
                  "X-CSRFToken": this.getCSRFToken(),
              },
              body: formData,
          });
        

        } else {
            // 🔁 EXISTING JSON FLOW (UNCHANGED)
            response = await fetch("/generator/send_email/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": this.getCSRFToken(),
                },
                body: JSON.stringify({
                    emails: emails,
                    targetId: this.targetId,
                    sent_from: sentFrom
                }),
            });
        }
        // Parse JSON response from server
        const data = await response.json();
        
        if (data.success) {
            // On successful send:
            this.showLoading(false);     // Hide loading indicator
            this.updateStepDisplay();    // Update UI to show completion
            // Display success state with reminders and target email
            this.showSuccessState(data.reminders, data.target_email);
        } else {
            // Show error if send failed
            this.showAlert("Failed to send email.", "danger");
        }
    } catch (error) {
        // Handle network errors
        console.error("Error:", error);
        this.showAlert("An error occurred while sending the email.", "danger");
        // Always hide loading indicator when done
        this.showLoading(false);
    // }
}
  async checkEmailHistoryAndProceed() {
  const email = document.getElementById("targetEmail").value.trim();
  const service =document.getElementById("id_service").value;
  console.log("Checking email history for:", email, service);
  try {
    const response = await fetch(
      `/generator/check-email-history/?email=${encodeURIComponent(email)}&service=${encodeURIComponent(service)}`
    );
    const data = await response.json();

    if (data.exists) {
      // Show modal
      document.getElementById("emailExistsBody").innerHTML = `
        <p><strong>This email was already contacted.</strong></p>
        <p><b>Subject:</b> ${data.service}</p>
        <p><b>Subject:</b> ${data.subject}</p>
        <p><b>Sent on:</b> ${data.sent_at}</p>
        <p>Do you want to send another email?</p>
      `;
      const modalEl = document.getElementById("emailExistsModal");
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
      const confirmBtn = document.getElementById("confirmGenerate");
      confirmBtn.onclick = () => {
        modal.hide();
        this.nextStep();   // proceed to step 2
        this.submitForm(); // generate emails
      };
    } else {
      // No previous email → proceed directly
      this.nextStep();
      this.submitForm();
    }
  } catch (error) {
    console.error("Email history check failed:", error);
    this.showAlert("Unable to verify email history.", "danger");
  }
}
    getCSRFToken() {
        // Function to get CSRF token from cookies
        const cookieValue = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
        return cookieValue ? cookieValue.split('=')[1] : '';
    }

  toggleEmailSelection(emailId) {
    const email = this.generatedEmails.find((e) => e.id === emailId)
    const checkbox = document.getElementById(`select-${emailId}`)
    const card = checkbox.closest(".email-card")

    if (email) {
      email.selected = checkbox.checked
      if (checkbox.checked) {
        card.classList.add("selected")
        this.selectedEmails.push(email)
      } else {
        card.classList.remove("selected")
        this.selectedEmails = this.selectedEmails.filter((e) => e.id !== emailId)
      }
    }
  }

  setupSendCampaign() {
    const sendContainer = document.getElementById("sendCampaignContent")
    sendContainer.innerHTML = `
            <div class="campaign-summary">
                <h5><i class="fas fa-chart-line me-2"></i>Campaign Summary</h5>
                <div class="summary-item">
                    <span>Target Company:</span>
                    <strong>${this.formData.targetCompanyName}</strong>
                </div>
                <div class="summary-item">
                    <span>Target Email:</span>
                    <strong>${this.formData.targetEmail}</strong>
                </div>
                <div class="summary-item">
                    <span>Framework Used:</span>
                    <strong>${this.formData.framework?.toUpperCase()}</strong>
                </div>
                <div class="summary-item">
                    <span>Emails Generated:</span>
                    <strong>${this.generatedEmails.length}</strong>
                </div>
            </div>

            <div class="send-options">
                <div class="send-option" onclick="app.selectSendOption('immediate')">
                    <i class="fas fa-bolt"></i>
                    <h6>Send Immediately</h6>
                    <p class="text-muted">Send selected emails right now</p>
                </div>
                <div class="send-option" onclick="app.selectSendOption('scheduled')">
                    <i class="fas fa-clock"></i>
                    <h6>Schedule Send</h6>
                    <p class="text-muted">Schedule emails for later</p>
                </div>
                <div class="send-option" onclick="app.selectSendOption('sequence')">
                    <i class="fas fa-list-ol"></i>
                    <h6>Email Sequence</h6>
                    <p class="text-muted">Send as a drip campaign</p>
                </div>
            </div>        `
  }

  selectSendOption(option) {
    document.querySelectorAll(".send-option").forEach((opt) => opt.classList.remove("selected"))
    event.target.closest(".send-option").classList.add("selected")

    this.selectedSendOption = option
    document.getElementById("sendCampaignBtn").disabled = this.selectedEmails.length === 0
  }
  showSuccessState(reminders, targetEmail) {
    let remindersHtml = '';
    
    // Generate HTML for reminders if they exist
    if (reminders && reminders.length > 0) {
        remindersHtml = `
            <div class="reminders-container mt-4">
                <h5 class="text-dark fw-semibold mb-3">
                    <i class="fas fa-clock me-2" style="font-size: 0.9rem;"></i>Scheduled Follow-ups
                </h5>
                <div class="row g-3">
                    ${reminders.map((reminder, index) => `
                        <div class="col-md-6 col-lg-6">
                            <div class="card shadow-sm border-0 h-90">
                                <div class="card-header bg-light border-0 py-2">
                                    <span>Reminder ${index + 1}</span>
                                </div>
                                <div class="card-body">
                                    <p class="mb-2 text-muted">
                                        <i class="fas fa-calendar-alt me-1" style="font-size: 0.85rem;"></i>
                                        <strong>Date:</strong> ${reminder.send_date}
                                        <span class="ms-2">(${reminder.days_after} days later)</span>
                                    </p>
                                    <p class="mb-0 text-dark">
                                        <i class="fas fa-envelope me-1" style="font-size: 0.85rem;"></i>
                                        <strong>Subject:</strong> ${reminder.subject}
                                    </p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Get container element and set its HTML
    const sendContainer = document.getElementById("sendCampaignContent");
    sendContainer.innerHTML = `
        <div class="success-state text-center p-5 bg-light rounded shadow-sm">
            <i class="fas fa-check-circle text-success mb-3" style="font-size: 2rem;"></i>
            <h4 class="text-success mb-2">Email Sent Successfully!</h4>
            <p class="text-muted mb-4">Your email has been delivered to <strong>${targetEmail}</strong>.</p>

            ${remindersHtml}

            <div class="mt-4">
                <div class="d-flex flex-column flex-sm-row justify-content-center gap-3">
                    <button class="btn btn-primary btn-lg px-4 py-2 d-flex align-items-center justify-content-center" id="newEmailBtn" style="min-width: 220px">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-plus me-2 text-white" ></i>
                            <span>Generate New Email</span>
                        </div>
                    </button>
                    <button class="btn btn-primary btn-lg px-4 py-2 d-flex align-items-center justify-content-center" id="viewAnalyticsBtn" style="min-width: 220px">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-chart-bar me-2 text-white" ></i>
                            <span>View Analytics</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add click handlers for the action buttons
    document.getElementById("newEmailBtn").addEventListener("click", () => {
        window.location.href = "/generator/generate_email/";
    });
    document.getElementById("viewAnalyticsBtn").addEventListener("click", () => {
    // This explicitly points to the 'users' app root which is mapped to HomeView (Dashboard)
    window.location.href = '/users/';
});
}

  resetApp() {
    this.currentStep = 1
    this.formData = {}
    this.generatedEmails = []
    this.selectedEmails = []

    // Reset all forms
    document.querySelectorAll("form").forEach((form) => form.reset())

    this.updateStepDisplay()
    this.showAlert("Ready to create a new campaign!", "info")
  }

  viewAnalytics() {
    this.showAlert("Analytics feature coming soon!", "info")
  }

  showLoading(show, message = "Generating your personalized emails...") {
    const overlay = document.getElementById("loadingOverlay")
    if (show) {
      overlay.querySelector("p").textContent = message
      overlay.style.display = "flex"
    } else {
      overlay.style.display = "none"
    }
  }

  showAlert(message, type = "info") {
    // Create and show Bootstrap alert
    const alertDiv = document.createElement("div")
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`
    alertDiv.style.cssText = "top: 20px; right: 20px; z-index: 10000; min-width: 300px;"
    alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>        `

    document.body.appendChild(alertDiv)

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove()
      }
    }, 5000)
  }
 renderAttachmentPreview() {
    if (!this.savedAttachmentId) return "";

    const select = document.getElementById("saved_attachment");
    const text = select.options[select.selectedIndex].text;

    return `
        <div style="
            margin-top:12px;
            padding-top:8px;
            border-top:1px dashed #ddd;
            font-size:14px;
            color:#444;
        ">
            <strong>📎 Saved Attachment</strong><br>
            ${text}
        </div>
    `;
}

}
// Initialize the app
const app = new EmailMarketingApp()
// Additional utility functions
document.addEventListener("DOMContentLoaded", () => {
  // File upload preview
  document.getElementById("productFiles").addEventListener("change", (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      const fileList = files.map((file) => file.name).join(", ")
      app.showAlert(`Files selected: ${fileList}`, "info")
    } 
    app.attachmentFile = e.target.files[0] || null
  })

  // Form validation styling
  document.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("blur", function () {
      if (this.hasAttribute("required") && !this.value.trim()) {
        this.classList.add("is-invalid")
      } else {
        this.classList.remove("is-invalid")
        this.classList.add("is-valid")
      }
    })
  })
})