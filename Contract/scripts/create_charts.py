"""
TAYAQAN Charts - Updated with Real Sepolia Test Results
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, Rectangle
import numpy as np
import os

# MATCH YOUR POSTER'S COLOR SCHEME
POSTER_COLORS = {
    'background': '#0a1628',
    'accent_cyan': '#00d9ff',
    'accent_blue': '#4a90e2',
    'purple': '#6c5ce7',
    'text_white': '#ffffff',
    'grid': '#1e3a5f',
    'glow': '#00ffff',
}

DATA_COLORS = ['#00d9ff', '#4a90e2', '#6c5ce7', '#a855f7', '#ec4899', '#f59e0b']

plt.rcParams['figure.dpi'] = 300
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.size'] = 11
plt.rcParams['text.color'] = POSTER_COLORS['text_white']
plt.rcParams['axes.labelcolor'] = POSTER_COLORS['text_white']
plt.rcParams['xtick.color'] = POSTER_COLORS['text_white']
plt.rcParams['ytick.color'] = POSTER_COLORS['text_white']

print("🎨 Creating charts with REAL Sepolia test results...")
print("=" * 70)

reports_dir = '../reports'
if not os.path.exists(reports_dir):
    os.makedirs(reports_dir)

# ==========================================
# REAL SEPOLIA TEST DATA (from your results)
# ==========================================

gas_data = {
    'Issue\nCertificate': 122285,
    'Revoke\nCertificate': 51650,
    'Add Employer\nAccess': 100147,
    'Remove Employer\nAccess': 37747,
    'Verify\nCertificate': 0,
    'Check Employer\nAccess': 0
}

latency_data = {
    'Issue\nCertificate': 11900,
    'Revoke\nCertificate': 11900,
    'Add Employer\nAccess': 12500,
    'Remove Employer\nAccess': 13700,
    'Verify\nCertificate': 104,
    'Check Employer\nAccess': 102
}

cost_data = {
    'Issue\nCertificate': 10.68,
    'Revoke\nCertificate': 4.51,
    'Add Employer\nAccess': 8.75,
    'Remove Employer\nAccess': 3.30
}

# ==========================================
# CHART 1: Gas Consumption
# ==========================================

print("\n📊 Chart 1: Gas Consumption...")

fig, ax = plt.subplots(figsize=(14, 8), facecolor=POSTER_COLORS['background'])
ax.set_facecolor(POSTER_COLORS['background'])

operations = list(gas_data.keys())
gas_values = list(gas_data.values())

bars = ax.barh(operations, gas_values, height=0.65, color=DATA_COLORS, 
               edgecolor=POSTER_COLORS['glow'], linewidth=2.5, alpha=0.9)

for i, (bar, value) in enumerate(zip(bars, gas_values)):
    if value > 0:
        ax.barh(operations[i], value, height=0.65, color=DATA_COLORS[i], 
                alpha=0.3, linewidth=0)
        
        bbox_props = dict(boxstyle='round,pad=0.6', facecolor=POSTER_COLORS['background'], 
                         edgecolor=POSTER_COLORS['accent_cyan'], linewidth=2.5, alpha=0.95)
        ax.text(value + 3500, i, f'{value:,}', va='center', ha='left',
                fontweight='bold', fontsize=12, color=POSTER_COLORS['accent_cyan'],
                bbox=bbox_props)
    else:
        bbox_props = dict(boxstyle='round,pad=0.6', facecolor=POSTER_COLORS['background'],
                         edgecolor='#2ecc71', linewidth=2.5, alpha=0.95)
        ax.text(10000, i, 'FREE', va='center', ha='left',
                fontweight='bold', fontsize=12, color='#2ecc71', bbox=bbox_props)

ax.set_xlabel('Gas Used (units)', fontweight='bold', fontsize=14, 
              color=POSTER_COLORS['text_white'], labelpad=10)
ax.set_title('TAYAQAN - Gas Consumption Analysis', 
             fontweight='bold', fontsize=16, pad=20, color=POSTER_COLORS['accent_cyan'])
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color(POSTER_COLORS['grid'])
ax.spines['bottom'].set_color(POSTER_COLORS['grid'])
ax.spines['left'].set_linewidth(2)
ax.spines['bottom'].set_linewidth(2)
ax.grid(axis='x', alpha=0.15, linestyle='--', color=POSTER_COLORS['grid'])
ax.tick_params(colors=POSTER_COLORS['text_white'])

plt.tight_layout()
plt.savefig(os.path.join(reports_dir, 'poster_chart1_gas.png'), 
            dpi=300, bbox_inches='tight', facecolor=POSTER_COLORS['background'])
print("  ✅ Saved: poster_chart1_gas.png")
plt.close()

# ==========================================
# CHART 2: Transaction Latency
# ==========================================

print("📊 Chart 2: Transaction Latency...")

fig, ax = plt.subplots(figsize=(15, 9), facecolor=POSTER_COLORS['background'])
ax.set_facecolor(POSTER_COLORS['background'])

operations_short = list(latency_data.keys())
latency_values = list(latency_data.values())

x_pos = np.arange(len(operations_short))
bars = ax.bar(x_pos, latency_values, width=0.7, color=DATA_COLORS,
              edgecolor=POSTER_COLORS['glow'], linewidth=2.5, alpha=0.9)

for i, (bar, value) in enumerate(zip(bars, latency_values)):
    height = bar.get_height()
    label = f'{value:,} ms\n≈{value/1000:.1f}s' if value > 1000 else f'{value} ms'
    
    bbox_props = dict(boxstyle='round,pad=0.6', facecolor=POSTER_COLORS['background'],
                     edgecolor=POSTER_COLORS['accent_cyan'], linewidth=2.5, alpha=0.95)
    ax.text(bar.get_x() + bar.get_width()/2., height + max(latency_values)*0.02,
            label, ha='center', va='bottom', fontweight='bold', fontsize=11,
            color=POSTER_COLORS['accent_cyan'], bbox=bbox_props)

ax.set_ylabel('Latency (milliseconds)', fontweight='bold', fontsize=14,
              color=POSTER_COLORS['text_white'], labelpad=10)
ax.set_title('TAYAQAN - Transaction Latency', 
             fontweight='bold', fontsize=16, pad=20, color=POSTER_COLORS['accent_cyan'])
ax.set_xticks(x_pos)
ax.set_xticklabels(operations_short, fontweight='bold', color=POSTER_COLORS['text_white'])
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color(POSTER_COLORS['grid'])
ax.spines['bottom'].set_color(POSTER_COLORS['grid'])
ax.spines['left'].set_linewidth(2)
ax.spines['bottom'].set_linewidth(2)
ax.grid(axis='y', alpha=0.15, linestyle='--', color=POSTER_COLORS['grid'])
ax.tick_params(colors=POSTER_COLORS['text_white'])

plt.tight_layout()
plt.savefig(os.path.join(reports_dir, 'poster_chart2_latency.png'),
            dpi=300, bbox_inches='tight', facecolor=POSTER_COLORS['background'])
print("  ✅ Saved: poster_chart2_latency.png")
plt.close()

# ==========================================
# CHART 3: Transaction Costs
# ==========================================

print("📊 Chart 3: Transaction Costs...")

fig, ax = plt.subplots(figsize=(12, 8), facecolor=POSTER_COLORS['background'])
ax.set_facecolor(POSTER_COLORS['background'])

operations_cost = list(cost_data.keys())
costs = list(cost_data.values())

bars = ax.bar(range(len(operations_cost)), costs, width=0.65, color=DATA_COLORS[:4],
              edgecolor=POSTER_COLORS['glow'], linewidth=2.5, alpha=0.9)

for i, (bar, value) in enumerate(zip(bars, costs)):
    height = bar.get_height()
    bbox_props = dict(boxstyle='round,pad=0.6', facecolor=POSTER_COLORS['background'],
                     edgecolor=POSTER_COLORS['accent_cyan'], linewidth=2.5, alpha=0.95)
    ax.text(bar.get_x() + bar.get_width()/2., height + 0.25,
            f'${value:.2f}', ha='center', va='bottom', fontweight='bold', fontsize=12,
            color=POSTER_COLORS['accent_cyan'], bbox=bbox_props)

note_bbox = dict(boxstyle='round,pad=0.8', facecolor=POSTER_COLORS['background'],
                edgecolor='#2ecc71', linewidth=2.5, alpha=0.95)
ax.text(0.5, 0.97, '✓ Verify and Check Access are FREE (0 gas)',
        transform=ax.transAxes, ha='center', va='top',
        bbox=note_bbox, fontweight='bold', fontsize=11, color='#2ecc71')

ax.set_ylabel('Cost (USD)', fontweight='bold', fontsize=14,
              color=POSTER_COLORS['text_white'], labelpad=10)
ax.set_title('TAYAQAN - Transaction Costs (Mainnet @ 30 gwei)', 
             fontweight='bold', fontsize=16, pad=20, color=POSTER_COLORS['accent_cyan'])
ax.set_xticks(range(len(operations_cost)))
ax.set_xticklabels(operations_cost, fontweight='bold', color=POSTER_COLORS['text_white'])
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color(POSTER_COLORS['grid'])
ax.spines['bottom'].set_color(POSTER_COLORS['grid'])
ax.spines['left'].set_linewidth(2)
ax.spines['bottom'].set_linewidth(2)
ax.grid(axis='y', alpha=0.15, linestyle='--', color=POSTER_COLORS['grid'])
ax.tick_params(colors=POSTER_COLORS['text_white'])

plt.tight_layout()
plt.savefig(os.path.join(reports_dir, 'poster_chart3_costs.png'),
            dpi=300, bbox_inches='tight', facecolor=POSTER_COLORS['background'])
print("  ✅ Saved: poster_chart3_costs.png")
plt.close()

# ==========================================
# CHART 4: Deployment Costs
# ==========================================

print("📊 Chart 4: Deployment Costs...")

fig, ax = plt.subplots(figsize=(13, 8), facecolor=POSTER_COLORS['background'])
ax.set_facecolor(POSTER_COLORS['background'])

contracts = ['InstitutionRegistry', 'CertificateRegistry', 'Total System']
deploy_gas = [832998, 1643801, 2476799]
deploy_costs = [72.75, 143.56, 216.32]

bars = ax.barh(range(len(contracts)), deploy_gas, height=0.65, color=DATA_COLORS[:3],
               edgecolor=POSTER_COLORS['glow'], linewidth=2.5, alpha=0.9)

for i, (gas, cost) in enumerate(zip(deploy_gas, deploy_costs)):
    bbox_props = dict(boxstyle='round,pad=0.7', facecolor=POSTER_COLORS['background'],
                     edgecolor=POSTER_COLORS['accent_cyan'], linewidth=2.5, alpha=0.95)
    ax.text(gas + 120000, i, f'{gas:,} gas\n${cost:.2f}',
            va='center', ha='left', fontweight='bold', fontsize=11,
            color=POSTER_COLORS['accent_cyan'], bbox=bbox_props)

ax.set_xlabel('Gas Used', fontweight='bold', fontsize=14,
              color=POSTER_COLORS['text_white'], labelpad=10)
ax.set_title('TAYAQAN - Deployment Costs (Mainnet @ 30 gwei)', 
             fontweight='bold', fontsize=16, pad=20, color=POSTER_COLORS['accent_cyan'])
ax.set_yticks(range(len(contracts)))
ax.set_yticklabels(contracts, fontweight='bold', color=POSTER_COLORS['text_white'])
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color(POSTER_COLORS['grid'])
ax.spines['bottom'].set_color(POSTER_COLORS['grid'])
ax.spines['left'].set_linewidth(2)
ax.spines['bottom'].set_linewidth(2)
ax.grid(axis='x', alpha=0.15, linestyle='--', color=POSTER_COLORS['grid'])
ax.tick_params(colors=POSTER_COLORS['text_white'])

plt.tight_layout()
plt.savefig(os.path.join(reports_dir, 'poster_chart4_deployment.png'),
            dpi=300, bbox_inches='tight', facecolor=POSTER_COLORS['background'])
print("  ✅ Saved: poster_chart4_deployment.png")
plt.close()

# ==========================================
# CHART 5: Scalability (100 Certificates)
# ==========================================

print("📊 Chart 5: Scalability Results...")

fig, ax = plt.subplots(figsize=(14, 8), facecolor=POSTER_COLORS['background'])
ax.set_facecolor(POSTER_COLORS['background'])

# Real scalability data from 100 certificate test
metrics = ['Total Gas', 'Avg Gas\nper Certificate', 'Total Cost\n(USD)', 'Avg Latency\n(seconds)']
values = [12219752, 122197, 1067.23, 12.2]
display_values = ['12,219,752', '122,197', '$1,067.23', '12.2s']

x_pos = np.arange(len(metrics))
bars = ax.bar(x_pos, [1, 1, 1, 1], width=0.6, color=DATA_COLORS[:4],
              edgecolor=POSTER_COLORS['glow'], linewidth=2.5, alpha=0.9)

for i, (bar, display) in enumerate(zip(bars, display_values)):
    bbox_props = dict(boxstyle='round,pad=0.8', facecolor=POSTER_COLORS['background'],
                     edgecolor=POSTER_COLORS['accent_cyan'], linewidth=3, alpha=0.95)
    ax.text(bar.get_x() + bar.get_width()/2., 0.5,
            display, ha='center', va='center', fontweight='bold', fontsize=16,
            color=POSTER_COLORS['accent_cyan'], bbox=bbox_props)

ax.set_ylim(0, 1.2)
ax.set_yticks([])
ax.set_xticks(x_pos)
ax.set_xticklabels(metrics, fontweight='bold', fontsize=12, color=POSTER_COLORS['text_white'])
ax.set_title('TAYAQAN - Scalability Test: 100 Certificates (Sepolia)', 
             fontweight='bold', fontsize=16, pad=20, color=POSTER_COLORS['accent_cyan'])
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_visible(False)
ax.spines['bottom'].set_color(POSTER_COLORS['grid'])
ax.spines['bottom'].set_linewidth(2)

plt.tight_layout()
plt.savefig(os.path.join(reports_dir, 'poster_chart5_scalability.png'),
            dpi=300, bbox_inches='tight', facecolor=POSTER_COLORS['background'])
print("  ✅ Saved: poster_chart5_scalability.png")
plt.close()
