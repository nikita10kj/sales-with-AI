import { Chart } from "@/components/ui/chart"
class EmailAnalytics {
  constructor() {
    this.currentSection = "overview"
    this.charts = {}
    this.campaignData = []

    this.init()
  }

  init() {
    this.bindEvents()
    this.loadCampaignData()
    this.initializeCharts()
    this.updateMetrics()
  }

  bindEvents() {
    // Sidebar navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const section = e.currentTarget.dataset.section
        this.switchSection(section)
      })
    })

    // Date range filter
    document.getElementById("dateRange").addEventListener("change", (e) => {
      this.updateMetrics(e.target.value)
      this.updateCharts(e.target.value)
    })

    // Chart controls
    document.querySelectorAll(".chart-controls .btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const metric = e.target.dataset.metric
        if (metric) {
          this.updatePerformanceChart(metric)
          // Update active state
          e.target.parentElement.querySelectorAll(".btn").forEach((b) => b.classList.remove("active"))
          e.target.classList.add("active")
        }
      })
    })
  }

  switchSection(section) {
    // Update sidebar
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active")
    })
    document.querySelector(`[data-section="${section}"]`).classList.add("active")

    // Update content
    document.querySelectorAll(".analytics-section").forEach((sec) => {
      sec.classList.remove("active")
    })
    document.getElementById(section).classList.add("active")

    this.currentSection = section

    // Load section-specific data
    this.loadSectionData(section)
  }

  loadSectionData(section) {
    switch (section) {
      case "campaigns":
        this.loadCampaignsTable()
        break
      case "performance":
        this.loadPerformanceCharts()
        break
      case "audience":
        this.loadAudienceCharts()
        break
      case "reports":
        this.loadReportsData()
        break
    }
  }

  loadCampaignData() {
    // Simulate campaign data
    this.campaignData = [
      {
        id: 1,
        name: "Tech Outreach Q4",
        framework: "AIDA",
        sent: 145,
        openRate: 32.1,
        clickRate: 8.7,
        responseRate: 12.3,
        status: "active",
        createdAt: "2024-01-15",
      },
      {
        id: 2,
        name: "Healthcare Partnership",
        framework: "PAS",
        sent: 89,
        openRate: 28.9,
        clickRate: 6.4,
        responseRate: 9.8,
        status: "completed",
        createdAt: "2024-01-10",
      },
      {
        id: 3,
        name: "Finance Sector Outreach",
        framework: "Before-After-Bridge",
        sent: 67,
        openRate: 26.3,
        clickRate: 5.9,
        responseRate: 8.1,
        status: "completed",
        createdAt: "2024-01-08",
      },
      {
        id: 4,
        name: "Holiday Greetings 2024",
        framework: "STAR",
        sent: 234,
        openRate: 45.2,
        clickRate: 12.1,
        responseRate: 15.7,
        status: "completed",
        createdAt: "2023-12-20",
      },
      {
        id: 5,
        name: "New Year Follow-up",
        framework: "AIDA",
        sent: 0,
        openRate: 0,
        clickRate: 0,
        responseRate: 0,
        status: "draft",
        createdAt: "2024-01-16",
      },
    ]
  }

  loadCampaignsTable() {
    const tbody = document.getElementById("campaignsTableBody")
    tbody.innerHTML = ""

    this.campaignData.forEach((campaign) => {
      const row = document.createElement("tr")
      row.innerHTML = `
        <td>
          <strong>${campaign.name}</strong>
          <br><small class="text-muted">Created: ${new Date(campaign.createdAt).toLocaleDateString()}</small>
        </td>
        <td><span class="badge bg-secondary">${campaign.framework}</span></td>
        <td>${campaign.sent.toLocaleString()}</td>
        <td>${campaign.openRate}%</td>
        <td>${campaign.clickRate}%</td>
        <td>${campaign.responseRate}%</td>
        <td><span class="status-badge status-${campaign.status}">${campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}</span></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="analytics.viewCampaign(${campaign.id})">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-outline-secondary" onclick="analytics.editCampaign(${campaign.id})">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="analytics.deleteCampaign(${campaign.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `
      tbody.appendChild(row)
    })
  }

  initializeCharts() {
    this.initPerformanceChart()
    this.initCampaignTypesChart()
    this.initFrameworkChart()
    this.initSendTimesChart()
    this.initIndustryChart()
    this.initCompanySizeChart()
    this.initActivityHeatmap()
  }

  initPerformanceChart() {
    const ctx = document.getElementById("performanceChart").getContext("2d")

    this.charts.performance = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Jan 1", "Jan 8", "Jan 15", "Jan 22", "Jan 29", "Feb 5", "Feb 12"],
        datasets: [
          {
            label: "Emails Sent",
            data: [120, 145, 167, 189, 201, 234, 267],
            borderColor: "#6f42c1",
            backgroundColor: "rgba(111, 66, 193, 0.1)",
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(0,0,0,0.1)",
            },
          },
          x: {
            grid: {
              display: false,
            },
          },
        },
      },
    })
  }

  initCampaignTypesChart() {
    const ctx = document.getElementById("campaignTypesChart").getContext("2d")

    this.charts.campaignTypes = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["AIDA", "PAS", "Before-After-Bridge", "STAR"],
        datasets: [
          {
            data: [45, 25, 20, 10],
            backgroundColor: ["#6f42c1", "#198754", "#ffc107", "#dc3545"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 20,
              usePointStyle: true,
            },
          },
        },
      },
    })
  }

  initFrameworkChart() {
    const ctx = document.getElementById("frameworkChart").getContext("2d")

    this.charts.framework = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["AIDA", "PAS", "Before-After-Bridge", "STAR"],
        datasets: [
          {
            label: "Open Rate %",
            data: [32.1, 28.9, 26.3, 45.2],
            backgroundColor: "rgba(111, 66, 193, 0.8)",
          },
          {
            label: "Response Rate %",
            data: [12.3, 9.8, 8.1, 15.7],
            backgroundColor: "rgba(25, 135, 84, 0.8)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 50,
          },
        },
      },
    })
  }

  initSendTimesChart() {
    const ctx = document.getElementById("sendTimesChart").getContext("2d")

    this.charts.sendTimes = new Chart(ctx, {
      type: "radar",
      data: {
        labels: ["9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM"],
        datasets: [
          {
            label: "Open Rate %",
            data: [15, 25, 35, 28, 22, 30, 32, 18],
            borderColor: "#6f42c1",
            backgroundColor: "rgba(111, 66, 193, 0.2)",
            pointBackgroundColor: "#6f42c1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 40,
          },
        },
      },
    })
  }

  initIndustryChart() {
    const ctx = document.getElementById("industryChart").getContext("2d")

    this.charts.industry = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Technology", "Healthcare", "Finance", "Education", "Manufacturing", "Other"],
        datasets: [
          {
            data: [35, 20, 15, 12, 10, 8],
            backgroundColor: ["#6f42c1", "#198754", "#ffc107", "#dc3545", "#0dcaf0", "#6c757d"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    })
  }

  initCompanySizeChart() {
    const ctx = document.getElementById("companySizeChart").getContext("2d")

    this.charts.companySize = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
        datasets: [
          {
            label: "Number of Companies",
            data: [450, 680, 520, 280, 120],
            backgroundColor: "rgba(111, 66, 193, 0.8)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    })
  }

  initActivityHeatmap() {
    const heatmapContainer = document.getElementById("activityHeatmap")
    const weeks = 52
    const days = 7

    let heatmapHTML = '<div class="heatmap-grid">'

    for (let week = 0; week < weeks; week++) {
      heatmapHTML += '<div class="heatmap-week">'
      for (let day = 0; day < days; day++) {
        const level = Math.floor(Math.random() * 5)
        heatmapHTML += `<div class="heatmap-day" data-level="${level}" title="Week ${week + 1}, Day ${day + 1}"></div>`
      }
      heatmapHTML += "</div>"
    }

    heatmapHTML += "</div>"
    heatmapContainer.innerHTML = heatmapHTML

    // Add CSS for heatmap
    const style = document.createElement("style")
    style.textContent = `
      .heatmap-grid {
        display: flex;
        gap: 2px;
        overflow-x: auto;
        padding: 1rem 0;
      }
      .heatmap-week {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .heatmap-day {
        width: 12px;
        height: 12px;
        border-radius: 2px;
        cursor: pointer;
      }
      .heatmap-day[data-level="0"] { background: #ebedf0; }
      .heatmap-day[data-level="1"] { background: #c6e48b; }
      .heatmap-day[data-level="2"] { background: #7bc96f; }
      .heatmap-day[data-level="3"] { background: #239a3b; }
      .heatmap-day[data-level="4"] { background: #196127; }
    `
    document.head.appendChild(style)
  }

  updatePerformanceChart(metric) {
    const data = {
      sent: [120, 145, 167, 189, 201, 234, 267],
      opened: [30, 36, 42, 47, 50, 58, 66],
      clicked: [6, 8, 9, 11, 12, 14, 16],
    }

    const colors = {
      sent: { border: "#6f42c1", bg: "rgba(111, 66, 193, 0.1)" },
      opened: { border: "#198754", bg: "rgba(25, 135, 84, 0.1)" },
      clicked: { border: "#ffc107", bg: "rgba(255, 193, 7, 0.1)" },
    }

    this.charts.performance.data.datasets[0].data = data[metric]
    this.charts.performance.data.datasets[0].borderColor = colors[metric].border
    this.charts.performance.data.datasets[0].backgroundColor = colors[metric].bg
    this.charts.performance.data.datasets[0].label = `Emails ${metric.charAt(0).toUpperCase() + metric.slice(1)}`
    this.charts.performance.update()
  }

  updateMetrics(dateRange = 30) {
    // Simulate metric updates based on date range
    const multiplier = dateRange / 30

    document.getElementById("totalSent").textContent = Math.floor(1247 * multiplier).toLocaleString()
    document.getElementById("openRate").textContent = (24.8 + Math.random() * 5 - 2.5).toFixed(1) + "%"
    document.getElementById("clickRate").textContent = (4.7 + Math.random() * 2 - 1).toFixed(1) + "%"
    document.getElementById("responseRate").textContent = (8.3 + Math.random() * 3 - 1.5).toFixed(1) + "%"
  }

  updateCharts(dateRange) {
    // Update all charts based on date range
    Object.values(this.charts).forEach((chart) => {
      if (chart && chart.update) {
        chart.update()
      }
    })
  }

  loadPerformanceCharts() {
    // Load performance-specific charts if not already loaded
    if (!this.charts.framework) {
      this.initFrameworkChart()
    }
    if (!this.charts.sendTimes) {
      this.initSendTimesChart()
    }
  }

  loadAudienceCharts() {
    // Load audience-specific charts if not already loaded
    if (!this.charts.industry) {
      this.initIndustryChart()
    }
    if (!this.charts.companySize) {
      this.initCompanySizeChart()
    }
  }

  loadReportsData() {
    // Simulate loading reports data
    console.log("Loading reports data...")
  }

  // Campaign actions
  viewCampaign(id) {
    const campaign = this.campaignData.find((c) => c.id === id)
    if (campaign) {
      alert(`Viewing campaign: ${campaign.name}`)
    }
  }

  editCampaign(id) {
    const campaign = this.campaignData.find((c) => c.id === id)
    if (campaign) {
      alert(`Editing campaign: ${campaign.name}`)
    }
  }

  deleteCampaign(id) {
    if (confirm("Are you sure you want to delete this campaign?")) {
      this.campaignData = this.campaignData.filter((c) => c.id !== id)
      this.loadCampaignsTable()
      this.showAlert("Campaign deleted successfully", "success")
    }
  }

  showAlert(message, type = "info") {
    const alertDiv = document.createElement("div")
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`
    alertDiv.style.cssText = "top: 20px; right: 20px; z-index: 10000; min-width: 300px;"
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `

    document.body.appendChild(alertDiv)

    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove()
      }
    }, 5000)
  }
}

// Initialize analytics
const analytics = new EmailAnalytics()

// Additional event listeners
//document.addEventListener('DOMContentLoaded', () => {
//  // Search functionality
//  const searchInput = document.querySelector('.search-box input')
//  if (searchInput) {
//    searchInput.addEventListener('input', (e) => {
//      const searchTerm = e.target.value.toLowerCase()
//      const rows = document.querySelectorAll('#campaignsTableBody tr')
//
//      rows.forEach(row => {\
//        const campaignName = row.querySelector('t
