// HA owns card markup and behavior. These overrides affect only the embedded document.
export const dashboardNavigationStyles = `
  ha-sidebar, ha-menu-button { display: none !important; }
  :host(hui-root) .header, :host(hui-root) app-header { display: none !important; }
  :host(ha-drawer) aside, :host(ha-drawer) .mdc-drawer { display: none !important; }
  :host(ha-drawer) .mdc-drawer-app-content { margin-left: 0 !important; }
  :host(hui-root) #view { padding-top: 0 !important; }
`;

export const dashboardCabaneStyles = `
  :root, :host {
    --primary-color: #365f6c !important;
    --accent-color: #bd724d !important;
    --primary-background-color: #fbf9f2 !important;
    --secondary-background-color: #e9ece2 !important;
    --card-background-color: #fffcf6 !important;
    --ha-card-background: #fffcf6 !important;
    --primary-text-color: #2e3835 !important;
    --secondary-text-color: #58675e !important;
    --disabled-text-color: #6f7771 !important;
    --divider-color: #d8d7cb !important;
    --ha-card-border-radius: 12px !important;
    --ha-card-border-width: 0px !important;
    --ha-card-box-shadow: none !important;
    --lovelace-background: #fbf9f2 !important;
    --ha-color-fill-neutral-quiet-resting: #eeefe8 !important;
    --ha-color-fill-neutral-normal-resting: #e9ece2 !important;
    --ha-color-fill-primary-normal-resting: #365f6c !important;
    --ha-color-text-primary: #2e3835 !important;
    --ha-color-text-secondary: #58675e !important;
    --ha-font-family-body: Roboto, sans-serif !important;
  }
`;
