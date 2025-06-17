class EmailMarketingApp {
  constructor() {
    this.currentStep = 1
    this.totalSteps = 3
    this.formData = {}
    this.generatedEmails = []
    this.selectedEmails = []

    this.init()
  }

  init() {
    this.bindEvents()
    this.updateStepDisplay()
  }

  bindEvents() {
    // Navigation buttons
    document.getElementById("nextBtn").addEventListener("click", () => this.nextStep())
    document.getElementById("prevBtn").addEventListener("click", () => this.prevStep())

    // Step navigation from sidebar
    document.querySelectorAll(".step").forEach((step) => {
      step.addEventListener("click", (e) => {
        const stepNumber = Number.parseInt(e.currentTarget.dataset.step)
        this.goToStep(stepNumber)
      })
    })

    // Generate emails button
//    document.getElementById("generateEmails").addEventListener("click", () => this.generateEmails())

    // Form submissions
    document.getElementById("targetFrameworkForm").addEventListener("submit", (e) => {
      e.preventDefault()
      this.nextStep()
      this.submitForm()
    })
  }

  nextStep() {
    if (this.validateCurrentStep()) {
      this.saveCurrentStepData()
      if (this.currentStep < this.totalSteps) {
        this.currentStep++
        this.updateStepDisplay()
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

    // Update navigation buttons
    const prevBtn = document.getElementById("prevBtn")
    const nextBtn = document.getElementById("nextBtn")

    prevBtn.style.display = this.currentStep === 1 ? "none" : "inline-block"

    if (this.currentStep === this.totalSteps) {
      nextBtn.style.display = "none"
    } else {
      nextBtn.style.display = "inline-block"
      nextBtn.innerHTML =
        this.currentStep === 4
          ? 'Generate & Review<i class="fas fa-arrow-right ms-2"></i>'
          : 'Next<i class="fas fa-arrow-right ms-2"></i>'
    }
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
    this.showLoading(true, "Submitting your details...");
    try {
    console.log("form",this.formData)
      const response = await fetch('/generator/generate_email/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCSRFToken(), // Include CSRF token if needed
        },
        body: JSON.stringify(this.formData),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      this.generatedEmails = data.emails; // Assuming the response contains the generated emails
      this.displayGeneratedEmails();
      this.showAlert("Details submitted successfully!", "success");
    } catch (error) {
      this.showAlert("Error submitting details. Please try again.", "danger");
    } finally {
      this.showLoading(false);
    }
  }

  getCSRFToken() {
    // Function to get CSRF token from cookies
    const cookieValue = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
    return cookieValue ? cookieValue.split('=')[1] : '';
  }

  displayGeneratedEmails() {
    const container = document.getElementById("emailsContainer")
    container.innerHTML = ""
    // Main email
      if (this.generatedEmails && this.generatedEmails.main_email) {
        const main = this.generatedEmails.main_email;
        const mainCard = document.createElement("div");
        mainCard.className = "email-card";
        mainCard.innerHTML = `
          <div class="email-header">
              <h5 class="email-title">${main.title}</h5>
              <div class="email-actions">
                  <button class="btn btn-sm btn-outline-primary" onclick="app.previewEmail(${main.id})">
                      <i class="fas fa-eye"></i> Preview
                  </button>
                  <button class="btn btn-sm btn-outline-secondary" onclick="app.editEmail(${main.id})">
                      <i class="fas fa-edit"></i> Edit
                  </button>
                  <div class="form-check ms-2">
                      <input class="form-check-input" type="checkbox" id="select-${main.id}"
                             onchange="app.toggleEmailSelection(${main.id})">
                      <label class="form-check-label" for="select-${main.id}">Select</label>
                  </div>
              </div>
          </div>
          <div class="email-body">
              <div class="email-subject">
                  <strong>Subject:</strong> ${main.subject}
              </div>
              <div class="email-content">
                  ${main.body.replace(/\n/g, "<br>")}
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
    const card = document.createElement("div")
    card.className = "email-card"
    card.innerHTML = `
            <div class="email-header">
                <h5 class="email-title">Follow Up Email - ${count}</h5>
                <div class="email-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="app.previewEmail(${email.id})">
                        <i class="fas fa-eye"></i> Preview
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="app.editEmail(${email.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <div class="form-check ms-2">
                        <input class="form-check-input" type="checkbox" id="select-${email.id}" 
                               onchange="app.toggleEmailSelection(${email.id})">
                        <label class="form-check-label" for="select-${email.id}">Select</label>
                    </div>
                </div>
            </div>
            <div class="email-body">
                <div class="email-subject">
                    <strong>Subject:</strong> ${email.subject}
                </div>
                <div class="email-content">
                    ${email.body.replace(/\n/g, "<br>")}
                </div>
            </div>
        `
    return card
  }

  previewEmail(emailId) {
    const email = this.generatedEmails.find((e) => e.id === emailId)
    if (email) {
      const modal = new bootstrap.Modal(document.getElementById("emailPreviewModal"))
      document.getElementById("emailPreviewContent").innerHTML = `
                <div class="email-template">
                    <div class="subject-line">Subject: ${email.subject}</div>
                    <div class="email-body">${email.body.replace(/\n/g, "<br>")}</div>
                    <div class="signature">
                        <p>Best regards,<br>
                        ${this.formData.senderName}<br>
                        ${this.formData.companyName}</p>
                    </div>
                </div>
            `
      modal.show()
    }
  }

  editEmail(emailId) {
    const email = this.generatedEmails.find((e) => e.id === emailId)
    if (email) {
      const modal = new bootstrap.Modal(document.getElementById("emailPreviewModal"))
      document.getElementById("emailPreviewContent").innerHTML = `
                <div class="mb-3">
                    <label class="form-label">Subject Line</label>
                    <input type="text" class="form-control" id="editSubject" value="${email.subject}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Email Body</label>
                    <textarea class="form-control" id="editBody" rows="15">${email.body}</textarea>
                </div>
            `

      document.getElementById("saveEmailChanges").onclick = () => {
        email.subject = document.getElementById("editSubject").value
        email.body = document.getElementById("editBody").value
        this.displayGeneratedEmails()
        modal.hide()
        this.showAlert("Email updated successfully!", "success")
      }

      modal.show()
    }
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
            </div>

            <div class="text-center">
                <button class="btn btn-success btn-lg" onclick="app.sendCampaign()" disabled id="sendCampaignBtn">
                    <i class="fas fa-paper-plane me-2"></i>Send Campaign
                </button>
            </div>
        `
  }

  selectSendOption(option) {
    document.querySelectorAll(".send-option").forEach((opt) => opt.classList.remove("selected"))
    event.target.closest(".send-option").classList.add("selected")

    this.selectedSendOption = option
    document.getElementById("sendCampaignBtn").disabled = this.selectedEmails.length === 0
  }

  async sendCampaign() {
    if (this.selectedEmails.length === 0) {
      this.showAlert("Please select at least one email to send.", "warning")
      return
    }

    this.showLoading(true, "Sending your campaign...")

    try {
      // Simulate sending emails
      await new Promise((resolve) => setTimeout(resolve, 2000))

      this.showSuccessState()
      this.showAlert(`Campaign sent successfully! ${this.selectedEmails.length} emails delivered.`, "success")
    } catch (error) {
      this.showAlert("Error sending campaign. Please try again.", "danger")
    } finally {
      this.showLoading(false)
    }
  }

  showSuccessState() {
    const sendContainer = document.getElementById("sendCampaignContent")
    sendContainer.innerHTML = `
            <div class="success-state">
                <i class="fas fa-check-circle"></i>
                <h3>Campaign Sent Successfully!</h3>
                <p class="text-muted">Your emails have been delivered to ${this.formData.targetEmail}</p>
                <div class="mt-4">
                    <button class="btn btn-primary me-2" onclick="app.resetApp()">
                        <i class="fas fa-plus me-2"></i>Create New Campaign
                    </button>
                    <button class="btn btn-outline-primary" onclick="app.viewAnalytics()">
                        <i class="fas fa-chart-bar me-2"></i>View Analytics
                    </button>
                </div>
            </div>
        `
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
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `

    document.body.appendChild(alertDiv)

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove()
      }
    }, 5000)
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
