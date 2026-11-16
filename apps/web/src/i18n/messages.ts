export const SUPPORTED_LOCALES = ['en', 'de'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_STORAGE_KEY = 'flowpro.locale'

interface Dictionary {
  [key: string]: string | Dictionary
}

export const messages: Record<Locale, Dictionary> = {
  en: {
    // Keyed by the backend problem-details `code`. Structure mirrors the code
    // exactly, so `attendance.geo.invalid` resolves here without a lookup table.
    apiErrors: {
      account: {
        email_already_registered:
          'An account with this email already exists. Sign in instead.',
        email_rejected: 'This email address cannot be used.',
        password_rejected:
          'Choose a longer password that is not easy to guess.',
        registration_disabled:
          'New accounts cannot be created on this instance.',
        current_password_incorrect: 'The current password is incorrect.',
        session_current: 'Use sign out to end the session you are using.',
        session_not_found: 'That session no longer exists.',
        session_required: 'Sign in to ask for a confirmation email.',
        token_invalid:
          'This link is invalid or has expired. Ask for a new one.',
        email_invalid: 'Enter a valid email address.',
        email_unchanged: 'This is already your email address.',
        email_taken:
          'This email address now belongs to another account, so your address stays unchanged.',
        workspace_not_found: 'You do not belong to that workspace.',
        invitation_other_address:
          'This invitation was sent to another email address. Sign in with that address to accept it.',
        two_factor_challenge_expired:
          'The sign-in took too long. Sign in again with your password.',
        two_factor_code_invalid: 'That code is incorrect. Try the current one.',
        two_factor_already_enabled: 'Two-step sign-in is already on.',
        two_factor_not_enabled:
          'Two-step sign-in is off, so there are no recovery codes.',
        two_factor_setup_missing:
          'Set up your authenticator app again, then enter its code.',
        shared_demo_account:
          'This is a shared demo login, so its sign-in settings cannot be changed.',
      },
      authentication: {
        invalid_credentials: 'The email or password is incorrect.',
      },
      user: {
        invitation_not_open:
          'This person already signs in, or their access is closed, so there is no invitation to send.',
        shared_demo_login:
          'This person is one of the shared demo logins, so they cannot be changed or deactivated.',
      },
      'approval-flow': {
        'assigned-to-another-approver':
          'This request is waiting on a different approver.',
        'current-step': {
          invalid: 'This approval step is no longer the current one.',
        },
      },
      attachments: {
        'content-type-not-allowed': 'That file type cannot be attached.',
        'empty-file': 'That file is empty.',
        'file-name-required': 'The file needs a name.',
        'file-too-large': 'That file is too large to attach.',
        'metadata-invalid': 'The attachment details are invalid.',
        'not-found': 'That attachment no longer exists.',
        'object-not-found': 'The stored file could not be found.',
        'owner-required': 'The attachment is missing an owner.',
        'permission-required':
          'You do not have permission to change this attachment.',
        'read-permission-required':
          'You do not have permission to open this attachment.',
      },
      attendance: {
        'booking-already-voided': 'This booking has already been voided.',
        'booking-not-accessible': 'You cannot change this booking.',
        'clock-in': {
          'invalid-state': 'You can only clock in before work has started.',
        },
        'clock-out': {
          'invalid-state': 'You can only clock out while working.',
        },
        'correction-reason': {
          invalid: 'Enter a reason for this correction.',
        },
        'device-sequence': {
          invalid: 'This device sent bookings out of order. Refresh and retry.',
        },
        'event-before-current-state':
          'That time is before your current attendance state.',
        geo: {
          'accuracy-invalid': 'The location accuracy reported is not usable.',
          incomplete: 'The location is incomplete.',
          invalid: 'The location reported is not valid.',
        },
        'invalid-range': 'Select a valid date range.',
        'occurred-at-in-future': 'You cannot book a time in the future.',
        'range-too-large':
          'That date range is too large. Choose a shorter one.',
        'resume-work': {
          'invalid-state': 'You can only resume work during a break.',
        },
        'start-break': {
          'invalid-state': 'You can only start a break while working.',
        },
        'state-missing': 'No attendance state was found for this day.',
      },
      employee: {
        'not-active': 'This employee account is not active.',
      },
      'idempotency-key': {
        invalid: 'The request could not be identified. Try again.',
        reused: 'This action was already submitted.',
      },
      onboarding: {
        already_completed: 'This workspace has already been set up.',
      },
      tenant: {
        country_code_invalid: 'Choose a valid country.',
        region_code_invalid: 'Choose a valid region for the selected country.',
        region_requires_country: 'Choose a country before choosing a region.',
      },
      payroll: {
        format: { invalid: 'Choose a supported export format.' },
        period: { required: 'Choose a payroll period.' },
      },
      request: {
        attachment: { 'too-large': 'That attachment is too large.' },
        'booking-correction': {
          empty: 'Enter at least one corrected time.',
        },
        'date-range': { invalid: 'Select a valid date range.' },
        kind: { invalid: 'Choose a valid request type.' },
        'not-found': 'That request no longer exists.',
        'not-submitted': 'That request has not been submitted yet.',
        'partial-day': { invalid: 'The partial-day selection is not valid.' },
        payload: { invalid: 'Some request details are invalid.' },
        recurrence: { invalid: 'The repeat pattern is not valid.' },
        'status-type': { required: 'Choose an absence type.' },
        subtype: { required: 'Choose a request subtype.' },
      },
      // Generic per-status copy used when a response carries no mapped code.
      status: {
        unavailable:
          'FlowPro is temporarily unavailable. Try again in a moment.',
      },
      sync: {
        aggregate: { required: 'The sync payload is missing its record.' },
        batch: { 'too-large': 'Too many changes were sent at once.' },
        'client-id': { required: 'The sync request is missing a client id.' },
        cursor: { invalid: 'The sync position is invalid. Retry the sync.' },
        protocol: { invalid: 'This app version cannot sync with the server.' },
      },
      timesheet: {
        period: { invalid: 'Choose a valid timesheet period.' },
      },
    },
    common: {
      resultsAnnouncement: '{{count}} results',
      language: 'Language',
      timezone: 'Timezone',
      save: 'Save',
      close: 'Close',
      closePanel: 'Close panel',
      update: 'Update',
      cancel: 'Cancel',
      continue: 'Continue',
      filter: 'Filter...',
      loading: 'Loading...',
      preparingLatestLocalData: 'Preparing the latest local data.',
      reset: 'Reset',
      search: 'Search',
      select: 'Select',
      noResults: 'No results found.',
      office: 'Office',
      homeOffice: 'Home office',
      monday: 'Monday',
      sunday: 'Sunday',
      yes: 'Yes',
      no: 'No',
      or: 'or',
      clearAll: 'Clear all',
      noItemsSelected: 'No items selected.',
    },
    commandUi: {
      commandPalette: 'Command palette',
      commandPaletteDescription: 'Search for a command to run...',
      searchPlaceholder: 'Type a command or search...',
      noMatchingAction: 'No matching FlowPro action.',
      people: 'People',
      myRequests: 'My requests',
      systemTheme: 'System',
    },
    dataTableUi: {
      bulkSelectionAnnouncement:
        '{{count}} {{entity}} selected. Bulk actions toolbar is available.',
      bulkActionsForSelection: 'Bulk actions for {{count}} selected {{entity}}',
      clearSelection: 'Clear selection',
      clearSelectionShortcut: 'Clear selection (Escape)',
      selectedCount: '{{count}} selected',
      selected: 'selected',
      noMatchingFilterOption: 'No matching filter option.',
      clearFilters: 'Clear filters',
      view: 'View',
      toggleColumns: 'Toggle columns',
      rowsPerPage: 'Rows per page',
      pageOf: 'Page {{page}} of {{total}}',
      previousPage: 'Previous page',
      nextPage: 'Next page',
      showingRange: 'Showing {{start}}-{{end}} of {{total}}',
      goToFirstPage: 'Go to first page',
      goToPreviousPage: 'Go to previous page',
      goToPage: 'Go to page {{page}}',
      goToNextPage: 'Go to next page',
      goToLastPage: 'Go to last page',
    },
    invitationUi: {
      title: 'Join {{workspace}}',
      description: 'This invitation was sent to {{email}}.',
      loadingTitle: 'Invitation',
      loading: 'Opening your invitation...',
      invalidTitle: 'This invitation does not work',
      invalidDescription:
        'Open the link from the invitation email again, or ask for a new invitation.',
      join: 'Join the workspace',
      signInToJoin:
        'You already have a FlowPro account with {{email}}. Sign in with it to join.',
      createAccount:
        'Choose your name and a password. You sign in with {{email}} from now on.',
      createAndJoin: 'Create account and join',
      otherAccountTitle: 'Signed in with another address',
      otherAccountDescription:
        'This invitation is for {{invited}}, but you are signed in as {{signedIn}}.',
      signOutAndContinue: 'Sign out and continue',
    },
    demoUi: {
      title: 'Try the demo',
      description:
        'Shared logins: everyone sees what you enter, and the demo is wiped every day at {{time}} UTC.',
      signInAs: 'Sign in as {{role}}',
      roles: {
        superadmin: 'Admin',
        manager: 'Manager',
        employee: 'Employee',
      },
      manualHint:
        'Or sign in below with the address of a login and the password {{password}}.',
      or: 'or',
      sharedLogin:
        'This is a shared demo login, so its email, password, two-step sign-in and other devices cannot be changed.',
    },
    twoFactorUi: {
      title: 'Two-step sign-in',
      description:
        'Signing in also asks for a code from an authenticator app on your phone, so a stolen password alone is not enough.',
      on: 'On',
      off: 'Off',
      setUp: 'Set up two-step sign-in',
      continue: 'Continue',
      scanInstructions:
        'Scan this QR code with an authenticator app, such as Aegis, 2FAS, Google Authenticator or Microsoft Authenticator. Then enter the six-digit code it shows.',
      qrLabel: 'QR code for your authenticator app',
      manualKey: 'Cannot scan it? Enter this key in the app instead:',
      code: 'Code from the app',
      codeRequired: 'Enter the code.',
      turnOn: 'Turn on',
      turnedOn: 'Two-step sign-in is on. Other sessions signed out: {{count}}.',
      saveCodes:
        'Save these recovery codes somewhere safe, such as a password manager. Each one signs you in once if you lose your phone. They are shown only now.',
      copyCodes: 'Copy',
      codesCopied: 'Recovery codes copied.',
      copyFailed: 'Could not copy. Select the codes and copy them by hand.',
      downloadCodes: 'Download',
      codesFileHeading: 'FlowPro recovery codes. Each code works once.',
      savedCodes: 'I saved them',
      recoveryCodesLeft: 'Unused recovery codes: {{count}}.',
      newRecoveryCodes: 'New recovery codes',
      turnOff: 'Turn off',
      turnedOff: 'Two-step sign-in is off.',
      signInTitle: 'Enter your code',
      signInDescription:
        'Open your authenticator app and enter the six-digit code for FlowPro.',
      signInRecoveryDescription:
        'Enter one of the recovery codes you saved when you set up two-step sign-in.',
      recoveryCode: 'Recovery code',
      verify: 'Verify',
      useRecoveryCode: 'Use a recovery code instead',
      useApp: 'Use the authenticator app instead',
    },
    profileUi: {
      localAccountEmail: 'signed-in@flowpro.local',
      peopleWorkspace: 'People workspace',
      signOut: 'Sign out',
      workspaces: 'Workspaces',
      switchingWorkspace: 'Switching workspace...',
      unsentChangesBlockSwitch:
        'Changes not yet sent: {{count}}. Go online or resolve them in the sync panel, then switch.',
      signOutDescription:
        'Are you sure you want to sign out? You will need to sign in again to access your account.',
    },
    configUi: {
      openThemeSettings: 'Open theme settings',
      themeSettings: 'Theme settings',
      themeSettingsDescription:
        'Adjust the appearance and layout to suit your preferences.',
      resetAllSettings: 'Reset all settings to default values',
      reset: 'Reset',
      resetSection: 'Reset {{section}}',
      selectOption: 'Select {{option}}',
      optionPreview: '{{option}} option preview',
      toggleTheme: 'Toggle theme',
      toggleSidebar: 'Toggle sidebar',
      selectThemePreference: 'Select theme preference',
      themeDescription:
        'Choose between system preference, light mode, or dark mode',
      sidebar: 'Sidebar',
      selectSidebarStyle: 'Select sidebar style',
      sidebarInset: 'Inset',
      sidebarFloating: 'Floating',
      sidebarStandard: 'Sidebar',
      sidebarDescription:
        'Choose between inset, floating, or standard sidebar layout',
      mobileSidebarDescription: 'Displays the mobile sidebar.',
      layout: 'Layout',
      selectLayoutStyle: 'Select layout style',
      layoutDefault: 'Default',
      layoutCompact: 'Compact',
      layoutFull: 'Full layout',
      layoutDescription:
        'Choose between default expanded, compact icon-only, or full layout mode',
      direction: 'Direction',
      selectSiteDirection: 'Select site direction',
      leftToRight: 'Left to right',
      rightToLeft: 'Right to left',
      directionDescription:
        'Choose between left-to-right or right-to-left site direction',
    },
    countries: {
      DE: 'Germany',
      AT: 'Austria',
      CH: 'Switzerland',
    },
    regions: {
      'DE-BW': 'Baden-Württemberg',
      'DE-BY': 'Bavaria',
      'DE-BE': 'Berlin',
      'DE-BB': 'Brandenburg',
      'DE-HB': 'Bremen',
      'DE-HH': 'Hamburg',
      'DE-HE': 'Hesse',
      'DE-MV': 'Mecklenburg-Vorpommern',
      'DE-NI': 'Lower Saxony',
      'DE-NW': 'North Rhine-Westphalia',
      'DE-RP': 'Rhineland-Palatinate',
      'DE-SL': 'Saarland',
      'DE-SN': 'Saxony',
      'DE-ST': 'Saxony-Anhalt',
      'DE-SH': 'Schleswig-Holstein',
      'DE-TH': 'Thuringia',
      'AT-1': 'Burgenland',
      'AT-2': 'Carinthia',
      'AT-3': 'Lower Austria',
      'AT-4': 'Upper Austria',
      'AT-5': 'Salzburg',
      'AT-6': 'Styria',
      'AT-7': 'Tyrol',
      'AT-8': 'Vorarlberg',
      'AT-9': 'Vienna',
      'CH-AG': 'Aargau',
      'CH-AI': 'Appenzell Innerrhoden',
      'CH-AR': 'Appenzell Ausserrhoden',
      'CH-BE': 'Bern',
      'CH-BL': 'Basel-Landschaft',
      'CH-BS': 'Basel-Stadt',
      'CH-FR': 'Fribourg',
      'CH-GE': 'Geneva',
      'CH-GL': 'Glarus',
      'CH-GR': 'Grisons',
      'CH-JU': 'Jura',
      'CH-LU': 'Lucerne',
      'CH-NE': 'Neuchâtel',
      'CH-NW': 'Nidwalden',
      'CH-OW': 'Obwalden',
      'CH-SG': 'St. Gallen',
      'CH-SH': 'Schaffhausen',
      'CH-SO': 'Solothurn',
      'CH-SZ': 'Schwyz',
      'CH-TG': 'Thurgau',
      'CH-TI': 'Ticino',
      'CH-UR': 'Uri',
      'CH-VD': 'Vaud',
      'CH-VS': 'Valais',
      'CH-ZG': 'Zug',
      'CH-ZH': 'Zurich',
    },
    roles: {
      employee: 'Employee',
      manager: 'Manager',
      hr: 'HR',
      admin: 'Admin',
      superadmin: 'Superadmin',
    },
    onboardingUi: {
      loadFailed: 'Your setup could not be loaded. Try again.',
      stepFailed: 'That step could not be saved. Try again.',
      title: 'Set up FlowPro',
      subtitle:
        'Four short steps. You can skip anything except your company details and finish it later in settings.',
      loading: 'Loading your setup',
      progress: 'Setup progress',
      progressLabel: 'Setup progress',
      required: 'Required',
      optional: 'Optional',
      skipped: 'Skipped',
      skipForNow: 'Skip for now',
      saveAndContinue: 'Save and continue',
      finishLater: 'Finish setup later',
      finishedToast: 'Your workspace is ready.',
      workspaceCreatedToast: 'Workspace created.',
      goToToday: 'Go to Today',
      alreadyDoneTitle: 'Setup is already complete',
      alreadyDoneDescription:
        'This workspace has finished its first-run setup. Change any of it from settings.',
      steps: {
        company: {
          title: 'Company and working time',
          description:
            'Sets the public holiday calendar and the weekly hours every timesheet is measured against.',
        },
        team: {
          title: 'Invite your team',
          description:
            'Invited people appear in your directory and can clock in as soon as they accept.',
        },
        absences: {
          title: 'Leave entitlement',
          description:
            'The yearly vacation balance new employees start with. Individual contracts can override it.',
        },
        firstClockIn: {
          title: 'First clock-in',
          description:
            'Start your own workday so you can see how FlowPro records it.',
        },
      },
      company: {
        nameLabel: 'Company name',
        countryLabel: 'Country',
        regionLabel: 'Region',
        regionNone: 'No region',
        regionHelp:
          'Public holidays differ by region, so this drives the calendar your team sees.',
        timeZoneLabel: 'Time zone',
        weeklyHoursLabel: 'Weekly hours',
        weeklyHoursHelp:
          'Standard full-time week. Part-time contracts are set per employee later.',
      },
      team: {
        deliveryTitle: 'Invitations are created in FlowPro',
        deliveryDescription:
          'Email delivery is not configured yet, so invited people appear as pending in your directory. Send them the sign-in link yourself for now.',
        emailsLabel: 'Email addresses',
        emailsPlaceholder: 'anna@example.com, ben@example.com',
        emailsHelp: 'Separate addresses with commas, spaces, or new lines.',
        roleLabel: 'Role for these invitations',
        invalidTitle: 'Some addresses were not recognised',
        invalidDescription: 'Check these entries: {{addresses}}',
        failedTitle: 'Some invitations could not be created',
        failedDescription:
          'These addresses were not invited: {{addresses}}. You can retry them from the users page.',
        sendInvites: 'Invite {{count}} people',
        invitedToast: 'Invited {{count}} people.',
      },
      absences: {
        annualLeaveLabel: 'Annual leave days',
        annualLeaveHelp:
          'Based on a five-day week. German law requires at least 20.',
        includedTitle: 'Sick leave and special leave are already available',
        includedDescription:
          'Your team can request them from day one. Adjust the rules any time in attendance policies.',
      },
      firstClockIn: {
        cardTitle: 'Clock in for the first time',
        cardDescription:
          'This records a real booking on today, so you can see the timeline, breaks, and totals working.',
        action: 'Clock in and finish setup',
        skip: 'Finish without clocking in',
      },
      claim: {
        title: 'Name your workspace',
        description:
          'This is the last step before FlowPro is yours. You can rename it later.',
        signedInAs: 'Signed in as {{email}}',
        nameLabel: 'Workspace name',
        nameHelp: 'Usually your company name. Your team will see this.',
        submit: 'Create workspace',
        errorTitle: 'Workspace could not be created',
        signInRequiredTitle: 'Sign in first',
        signInRequiredDescription:
          'Creating a workspace needs an active sign-in.',
      },
      errors: {
        saveFailedTitle: 'That step could not be saved',
        companyNameRequired: 'Enter a company name with at least 2 characters.',
        workspaceNameRequired:
          'Enter a workspace name with at least 2 characters.',
        weeklyHoursRequired: 'Enter weekly hours as a number.',
        weeklyHoursRange:
          'Weekly hours must be between {{min}} and {{max}}. German law caps the working week at 48 hours on average.',
        leaveDaysRequired: 'Enter leave days as a number.',
        leaveDaysRange: 'Leave days must be between {{min}} and {{max}}.',
        alreadyClaimed:
          'This account already belongs to a workspace. Sign in instead.',
      },
    },
    auth: {
      signUpFailed: 'The account could not be created. Try again.',
      flowProBrand: 'FlowPro',
      email: 'Email',
      emailPlaceholder: 'name@example.com',
      password: 'Password',
      passwordPlaceholder: '********',
      confirmPassword: 'Confirm password',
      signIn: 'Sign in',
      signUp: 'Sign up',
      createAccount: 'Create account',
      forgotPassword: 'Forgot password?',
      forgotPasswordTitle: 'Forgot Password',
      forgotPasswordDescription:
        'Enter your registered email and we will send you a link to reset your password.',
      noAccountQuestion: "Don't have an account?",
      signingIn: 'Signing in...',
      sendingEmail: 'Sending email...',
      emailSentTo: 'Email sent to {{email}}',
      error: 'Error',
      continue: 'Continue',
      verify: 'Verify',
      oneTimePassword: 'One-time password',
      twoFactorAuthentication: 'Two-factor authentication',
      otpDescription:
        'Please enter the authentication code. We have sent the authentication code to your email.',
      didntReceiveCode: "Haven't received it?",
      resendNewCode: 'Resend a new code',
      signInDescription: 'Sign in to FlowPro with your account.',
      signUpDescription:
        'Create your account, then name the workspace for your team.',
      createAccountAgreementPrefix: 'By creating an account, you agree to our',
      termsOfService: 'Terms of Service',
      privacyPolicy: 'Privacy Policy',
      and: 'and',
      superadminHint:
        'Superadmin: founder@flowpro.local. Seed worker accounts use their seeded email and the configured worker password.',
      noWorkspaceYet: 'No workspace yet?',
      createWorkspace: 'Create one',
      signUpTitle: 'Start with FlowPro',
      signUpAction: 'Create your workspace',
      signUpHaveAccount: 'Already have a workspace?',
      signUpValueCompliance:
        'Records working time the way German law requires, with breaks and sign-off built in.',
      signUpValueLeave:
        'Vacation, sick leave, and approvals in one place, with balances that stay correct.',
      signUpValueTeam:
        'Invite your team and see who is available before you approve anything.',
      signUpUnavailableTitle: 'Self-serve signup is not enabled here',
      signUpUnavailableDescription:
        'New accounts cannot be created on this instance. Ask your administrator for an invitation.',
      returnToSignIn: 'Return to sign in',
      displayName: 'Your name',
      sendResetLink: 'Send reset link',
      resetLinkSent:
        'If an account exists for {{email}}, we sent it a link to reset the password. Check your inbox.',
      resetPasswordTitle: 'Choose a new password',
      resetPasswordDescription:
        'The new password replaces the old one and signs you out on every device.',
      newPassword: 'New password',
      setNewPassword: 'Set new password',
      passwordResetDone: 'Your password was changed. Sign in with the new one.',
      linkInvalidTitle: 'This link does not work',
      linkMissing: 'Open the link from the email again, or ask for a new one.',
      requestNewLink: 'Ask for a new link',
      verifyEmailTitle: 'Confirm your email',
      verifyingEmail: 'Confirming your email address...',
      emailVerified: 'Your email address is confirmed.',
      confirmEmailChangeTitle: 'Confirm your new email address',
      confirmingEmailChange: 'Confirming your new email address...',
      emailChanged:
        'Your account now uses {{email}}. Sign in with this address from now on.',
      continueToApp: 'Continue',
      passwordPolicy:
        'At least {{count}} characters. A few unrelated words work well.',
      accountDetailsCaptured: 'Account details captured for {{email}}',
      welcomeBack: 'Welcome back, {{name}}!',
      invalidCredentials: 'The email or password is incorrect.',
      simulationHint:
        'Local simulation accepts seeded active users and users created in this browser.',
      errors: {
        emailRequired: 'Please enter your email',
        passwordRequired: 'Please enter your password',
        passwordMinLength: 'Password must be at least 7 characters long',
        passwordTooShort: 'Use at least {{count}} characters.',
        displayNameRequired: 'Please enter your name',
        confirmPasswordRequired: 'Please confirm your password',
        passwordsDontMatch: "Passwords don't match.",
        enterSixDigitCode: 'Please enter the 6-digit code.',
      },
    },
    nav: {
      workday: 'Workday',
      administration: 'Administration',
      today: 'Today',
      myTime: 'My Time',
      planning: 'Planning',
      requests: 'Requests',
      teamAvailability: 'Team Availability',
      reports: 'Reports',
      users: 'Users',
      privacyAudit: 'Privacy Audit',
      settings: 'Settings',
      attendancePolicies: 'Attendance Policies',
      levelUser: 'User',
      levelManager: 'Manager',
      levelAdministrator: 'Administrator',
    },
    today: {
      title: 'Today',
      subtitle: '{{date}} · clocking, breaks, and requests.',
      newRequest: 'New request',
      timesheet: 'Timesheet',
    },
    periodPicker: {
      month: 'Month',
      year: 'Year',
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
    },
    todayUi: {
      status: 'Status',
      preparingToday: 'Preparing today...',
      unknownDevice: 'Unknown device',
      mobileBrowser: 'Mobile browser',
      desktopBrowser: 'Desktop browser',
      nextLocation: 'Next location',
      workLocation: 'Work location',
      goodMorning: 'Good morning, {{name}}',
      notWorking: 'Not working',
      chooseLocationClockIn:
        'Choose your location and clock in when you start.',
      ready: 'Ready',
      youAreWorking: 'You are working',
      workingStarted: 'Working · Started {{time}}',
      currentLocation: 'Current location: {{location}}.',
      workingBadge: 'Working',
      breakInProgress: 'Break in progress',
      onBreak: 'On break · {{duration}}',
      resumeAfterBreak: 'Resume work when your break is over.',
      onBreakBadge: 'On break',
      finishedForToday: 'Finished for today',
      finishedForTodayDescription:
        'Clock in again for a flexible second session, or manage a correction.',
      finished: 'Finished',
      clockInAgain: 'Clock in again',
      clockIn: 'Clock in',
      clockOut: 'Clock out',
      startBreak: 'Start break',
      resumeWork: 'Resume work',
      correctTodaysTime: "Correct today's time",
      requestLeave: 'Request leave',
      correctMissingTime: 'Correct missing time',
      bookingSource: 'Booking source',
      manualCorrection: 'Manual correction',
      locationCapturedWithin: 'location captured within {{meters}}m',
      locationOptional: 'location optional',
      updateLocation: 'Update location',
      locating: 'Locating...',
      captureLocation: 'Capture location',
      manageBookings: 'Manage bookings',
      openRequests: 'Open requests',
      openRequestsDescription:
        'Requests that still need a decision or follow-up.',
      viewAll: 'View all',
      noOpenRequests: 'No open requests',
      noOpenRequestsDescription:
        'Create a request when you need leave, remote work, or a booking correction.',
      createRequest: 'Create request',
      manageTodaysBookings: "Manage today's bookings",
      manageTodaysBookingsDescription:
        'Correct or void a same-day booking. The original evidence stays preserved and every change is audited on the server.',
      noBookingsToday: 'No bookings today',
      noBookingsTodayDescription:
        'Clock in from Today to start the timeline. Same-day edits will appear here after the first clock event.',
      bookingSyncPendingNotice:
        'This booking is still syncing to the server. It can be corrected or voided once syncing completes.',
      noDeviceRecorded: 'No device recorded',
      time: 'Time',
      in: 'In',
      out: 'Out',
      workedToday: 'Worked today',
      breakToday: 'Break today',
      started: 'Started',
      breakStarted: 'Break started',
      source: 'Source',
      browser: 'Browser',
      manualEdit: 'Manual edit',
      terminal: 'Terminal',
      system: 'System',
      location: 'Location',
      deleteBookingQuestion: 'Delete booking?',
      deleteBookingDescription:
        'This voids the booking on the server. The original record remains preserved in the audit trail.',
      correctionReason: 'Reason for change',
      correctionReasonPlaceholder:
        'Explain why this booking needs to be corrected or voided.',
      keepBooking: 'Keep booking',
      deleteBooking: 'Delete booking',
      saveEvent: 'Save event',
      unableToBookTime: 'Unable to book time.',
      bookingSaved: 'Time booking saved.',
      bookingQueuedOffline:
        'Time booking saved locally and queued for sync when the API is available.',
      clockEventUpdated: 'Clock event updated.',
      unableToUpdateEvent: 'Unable to update event.',
      bookingRemovedFromToday: 'Booking removed from today.',
      unableToRemoveBooking: 'Unable to remove booking.',
      yesterdayClosed: 'Yesterday was closed.',
      unableToCloseYesterday: 'Unable to close yesterday.',
      mutationErrors: {
        validation: 'Check the booking time and reason, then try saving again.',
        conflict:
          'This change would break the booking sequence. Create a correction request instead.',
        unavailable:
          'FlowPro API is currently unavailable. Try again in a moment.',
      },
      inProgress: 'In progress',
      todayTotals: 'Today totals',
      calculatedFromLocalClockEvents:
        'Calculated from server-synced clock events.',
      worked: 'Worked',
      break: 'Break',
      flex: 'Flex',
      bookings: 'Bookings',
      monthlyBalancesHint:
        'Monthly balances and vacation entitlement are managed in Timesheet and Reports.',
      dayTimeline: 'Day timeline',
      dayTimelineDescription: 'Today at a glance.',
      myTimesheetsDescription:
        'Today and the previous workday as a compact attendance chart.',
      timelineEmpty: 'No booking yet. Clock in to start the timeline.',
      timelineClockedInOffice: 'Clocked in · Office',
      timelineClockedInHomeOffice: 'Clocked in · Home office',
      timelineBreakStarted: 'Break started',
      timelineResumedWork: 'Resumed work',
      timelineClockedOut: 'Clocked out',
      workStateAnnouncement: 'Work state: {{state}}',
      commandErrors: {
        'clock-in.invalid-state':
          'You can only clock in before work has started.',
        'start-break.invalid-state':
          'You can only start a break while working.',
        'resume-work.invalid-state': 'You can only resume work during a break.',
        'clock-out.invalid-state': 'You can only clock out while working.',
      },
    },
    todayAttentionUi: {
      title: 'Attention',
      description: 'Small items worth checking.',
      yesterdayStillOpen: 'Yesterday is still open',
      yesterdayStillOpenDescription:
        'FlowPro detected an unfinished workday. Close it with the time you actually stopped working.',
      closeDay: 'Close day',
      breakRuleWarning: 'Break rule warning',
      needBreakTime: 'You still need {{duration}} break time. ',
      aboveTenHourGuideline:
        'You are {{duration}} above the 10-hour working guideline.',
      noUrgentIssues: 'No urgent attendance issues detected.',
      openPlanning: 'Open planning',
    },
    requestsPage: {
      title: 'Requests',
      subtitle: 'Create, track, and review absence and correction requests.',
      syncing: 'Syncing {{count}}',
      tabCreate: 'Create',
      tabMine: 'Mine',
      tabApprovals: 'Approvals',
      tabHistory: 'History',
      restricted:
        'Approval queue is available to managers, HR, and administrators.',
      approvingFor: 'Approving for: {{teams}}',
    },
    timesheetPage: {
      title: 'Timesheet',
      payrollCsv: 'Payroll CSV',
      exportPdf: 'Export PDF',
      exportScope: '{{employee}} · {{period}}',
      payrollRestricted:
        'Only HR, administrators, and superadmins can export payroll.',
      payrollExported: 'Payroll CSV exported.',
      exportFailed: 'Unable to complete the export workflow.',
      printBlocked:
        'Printable HTML exported because the print window was blocked.',
      pdfPrepared: 'PDF print view prepared.',
      signRestricted:
        'Only an authorized manager, HR, or admin can sign this month.',
      resolveExceptions:
        'Resolve timesheet exceptions before signing the month.',
      signFailed: 'Unable to sign this month.',
      signedLocked: 'Timesheet signed and locked.',
    },
    requests: {
      status: {
        submitted: 'Submitted',
        approved: 'Approved',
        rejected: 'Rejected',
        cancelled: 'Cancelled',
      },
      kind: {
        absence: 'Absence',
        bookingCorrection: 'Booking correction',
        officialAbsence: 'Official absence',
      },
    },
    requestsUi: {
      historyTitle: 'History',
      historySubtitle: 'Closed requests with final decisions and outcomes.',
      searchRequests: 'Search requests...',
      clearSearch: 'Clear search',
      approvalTitle: 'Approval queue',
      approvalSubtitle: 'Filter, review, and decide submitted requests.',
      policyBlock: 'policy block',
      policyBlocks: 'policy blocks',
      warning: 'warning',
      warnings: 'warnings',
      employee: 'Employee',
      allEmployees: 'All employees',
      requestType: 'Request type',
      allRequestTypes: 'All request types',
      selectedForBatch: '{{count}} selected for batch review',
      rejectSelected: 'Reject selected',
      approveSelected: 'Approve selected',
      date: 'Date',
      request: 'Request',
      person: 'Person',
      type: 'Type',
      details: 'Details',
      status: 'Status',
      actions: 'Actions',
      loadingRequests: 'Loading requests',
      loadingRequestsDescription:
        'Checking locally stored requests, approvals, attachments, and sync metadata.',
      noRequestsTitle: 'No requests in this view',
      noRequestsDescription:
        'Try another filter or create a leave, booking correction, or official absence request from the New request tab.',
      review: 'Review',
      hideDetails: 'Hide details',
      showDetails: 'Show details',
      ownCorrectionsOnly: 'Own corrections only',
      correctTime: 'Correct time',
      dayLength: 'Day length',
      weeklyOccurrences: 'Weekly, {{count}} times',
      series: 'Series',
      privateDetailsMasked: 'Private details masked',
      employeeReason: 'Employee reason',
      reasonHiddenByPolicy:
        'Hidden by privacy policy. HR/Admin and the employee can view the reason.',
      selectRequestRow: 'Select request row',
      cancelRequest: 'Cancel request',
      reviewRequest: 'Review request',
      hiddenByPrivacyPolicy:
        'This request is hidden by the current privacy policy.',
      protected: 'Protected',
      gdprPrivacyByDefault: 'GDPR privacy by default',
      detailsHidden: 'Details hidden',
      onlyHrAdminEmployeeCanView:
        'Only HR/Admin and the employee can view sensitive request details.',
      checkOperationalImpact:
        'Check the operational impact before approving or rejecting.',
      approvalRoute: 'Approval route',
      autoApprovedByPolicy: 'Auto-approved by attendance policy.',
      unassignedApprover: 'Unassigned',
      waitingForApprover: 'Waiting for {{names}}',
      approvalStepStatus: {
        pending: 'Pending',
        approved: 'Approved',
        rejected: 'Rejected',
      },
      rejecting: 'Rejecting...',
      reject: 'Reject',
      approving: 'Approving...',
      approveAdjusted: 'Approve adjusted',
      approve: 'Approve',
      managerComment: 'Manager comment',
      optionalDecisionNote:
        'Optional decision note for the employee and audit trail...',
      decisionActionsDisabled:
        'Decision actions are disabled because this request is already {{status}}.',
      approveAdjustedHint:
        'Approve adjusted becomes active after at least one date/time change.',
      policyBlocksMustBeResolved:
        'Policy blocks must be resolved before approving adjusted details.',
      submitting: 'Submitting...',
      dates: 'Dates',
      duration: 'Duration',
      submitted: 'Submitted',
      daySingular: 'day',
      dayPlural: 'days',
      selectAllVisibleRequests: 'Select all visible requests',
      draftSummary: 'Draft summary',
      attachments: 'Attachments',
      attachmentAdd: 'Add files',
      attachmentDescription:
        'Optional evidence. Files are uploaded securely before the request is submitted.',
      uploadingAttachments: 'Uploading attachments...',
      attachmentUploadFailed: 'Unable to upload attachment.',
      attachmentDeleteFailed: 'Unable to delete attachment.',
      delete: 'Delete',
      deleting: 'Deleting...',
      submitRequest: 'Submit request',
      submittingRequest: 'Submitting…',
      clearDraft: 'Clear draft',
      completeRequiredFields: 'Complete the required fields to submit.',
      policyCheck: 'Coverage and policy check',
      policyBlockLabel: 'Policy block',
      managerWarning: 'Manager warning',
      conflictWarning: 'Conflict warning',
      auditHidden: 'Audit hidden',
      auditHiddenDescription:
        'Full audit timelines are restricted to HR/Admin and the employee.',
      auditTimeline: 'Audit timeline',
      noAuditEvents: 'No audit events yet',
      noAuditEventsDescription:
        'Decision and visibility events will appear here once this request moves through review.',
      approveWithChanges: 'Approve with changes',
      approveWithChangesDescription:
        'Replace the submitted request with adjusted dates or times and approve the replacement.',
      editing: 'Editing',
      edit: 'Edit',
      from: 'From',
      to: 'To',
      adjustedDayLength: 'Adjusted day length',
      end: 'End',
      clockIn: 'Clock-in',
      clockOut: 'Clock-out',
      adjustmentRequired:
        'Change at least one date, time, or day-length value before approving adjusted details.',
      planAbsence: 'Plan absence',
      planAbsenceDescription:
        'Vacation, sick leave, home office, or special leave.',
      fixBooking: 'Fix booking',
      fixBookingDescription:
        'Forgotten clock-in, clock-out, break, or booking pair.',
      officialAbsence: 'Official absence',
      officialAbsenceDescription:
        'Correct official absence records for a workday.',
      oneFocusedForm: 'One focused form for the selected request type.',
      preselectedRequestKind:
        '{{type}} was preselected from your previous action. You can still choose another request type.',
      remark: 'Remark',
      optionalNote: 'Optional note for the reviewer...',
      absenceType: 'Absence type',
      repeat: 'Repeat',
      doesNotRepeat: 'Does not repeat',
      weekly: 'Weekly',
      occurrences: 'Occurrences',
      correctionType: 'Correction type',
      officialAbsenceType: 'Official absence type',
      beginning: 'Beginning',
      bookingTypePair: 'Add booking pair',
      bookingTypeClockIn: 'Add clock-in',
      bookingTypeClockOut: 'Add clock-out',
      bookingTypeBreak: 'Add break',
      bookingTypeSpecial: 'Special booking',
      officialTypeFullDay: 'Complete day',
      officialTypeBeforeStart: 'Before work starts',
      officialTypeAfterEnd: 'After work ends',
      partialFullDay: 'Full day',
      partialMorning: 'Morning',
      partialAfternoon: 'Afternoon',
      partialCustomHours: 'Custom hours',
      filesCount: '{{count}} file(s)',
      requestSubmitted: 'Request submitted.',
      recurringRequestsSubmitted: '{{count}} recurring requests submitted.',
      unableToSubmitRequest: 'Unable to submit request.',
      requestApproved: 'Request approved.',
      requestRejected: 'Request rejected.',
      unableToDecideRequest: 'Unable to decide request.',
      batchRequestsApproved: '{{count}} requests approved.',
      batchRequestsRejected: '{{count}} requests rejected.',
      unableToDecideRequests: 'Unable to decide requests.',
      adjustedRequestApproved: 'Adjusted request approved.',
      unableToApproveAdjustedRequest: 'Unable to approve adjusted request.',
      requestCancelled: 'Request cancelled.',
      unableToCancelRequest: 'Unable to cancel request.',
      rejectedInBatchReview: 'Rejected in batch review.',
      approvedInBatchReview: 'Approved in batch review.',
      policyInvalidDateRange: 'The end date must be after the start date.',
      policyInvalidPartialDay:
        'Custom partial-day requests need a valid start and end time.',
      policyOwnRequestConflict:
        'You already have a submitted or approved request in this period.',
      policyVacationBalance:
        'This request needs {{requested}} vacation days, but only {{available}} are available.',
      policyHomeOfficeLimit:
        'Home office would reach {{days}} days in {{month}}; policy target is {{target}}.',
      policyTeamCoverage:
        'Several teammates are already unavailable in this period. Manager review should check coverage.',
      aiReadyWorkflow: 'AI-ready workflow',
      aiReadyWorkflowDescription:
        'Future AI can fill this draft from natural language, then keep this review step before submit.',
      validation: {
        endDateBeforeStart: 'The end date must be after the start date.',
        chooseStatusType: 'Choose an absence or status type.',
        addBookingTime: 'Add at least one booking time.',
        validPartialDayRange: 'Add a valid custom partial-day time range.',
        recurrenceRange: 'Recurring requests can contain 1 to 12 occurrences.',
        attachmentSize: 'Attachments must be 10 MB or smaller.',
        onlySubmittedCanBeDecided: 'Only submitted requests can be decided.',
        onlySubmittedCanBeCancelled:
          'Only submitted requests can be cancelled.',
        onlySubmittedCanBeAdjusted: 'Only submitted requests can be adjusted.',
      },
      policyWarnings: {
        ownRequestConflict:
          'You already have a submitted or approved request in this period.',
        vacationBalance:
          'This request needs {{requestedVacationDays}} vacation days, but only {{vacationAvailableDays}} are available.',
        homeOfficeLimit:
          'Home office would reach {{currentDays}} days in {{monthKey}}; policy target is {{maxDays}}.',
        teamCoverage:
          'Several teammates are already unavailable in this period. Manager review should check coverage.',
        recurrencePattern:
          'Recurring requests are reviewed per occurrence; each week can still be accepted or rejected individually.',
        vacationEntitlement:
          'No vacation balance is available for the requested period.',
      },
      seedReasons: {
        focusDay: 'Focus day for implementation work.',
        summerVacation: 'Summer vacation.',
        privateAppointment: 'Private appointment.',
        familyTravel: 'Family travel.',
        forgotTerminalClockIn: 'Forgot to clock in from the terminal.',
      },
      seedLabels: {
        vacation: 'Vacation',
        addBookingPair: 'Add booking pair',
      },
      auditSummaries: {
        submitted: '{{employeeName}} submitted {{subtype}}.',
        decided: '{{actorName}} {{status}} {{subtype}}.',
        cancelled: '{{actorName}} cancelled {{subtype}}.',
      },
    },
    timesheetUi: {
      day: 'Day',
      worked: 'Worked',
      target: 'Target',
      flex: 'Flex',
      break: 'Break',
      breaks: 'Breaks',
      periodSummary: 'Period summary',
      metric: 'Metric',
      start: 'Start',
      sum: 'Sum',
      result: 'Result',
      current: 'Current',
      workedHours: 'Worked hours',
      paidHours: 'Paid hours',
      targetHours: 'Target hours',
      flexBalance: 'Flex balance',
      selectedEmployee: 'Selected employee',
      periodFilterDescription:
        'Choose which month should be available for review and export.',
      payrollExportRoleNote:
        'Payroll export is available to HR, administrators, and superadmins.',
      decimalHours: 'Decimal hours',
      scheduledMonth: 'Scheduled month',
      scheduledToDate: 'Scheduled to date',
      currentPeriodBalance: 'Current period balance',
      recordedBreakTime: 'Recorded break time',
      breakBalance: 'Break balance',
      comment: 'Comment',
      correctedBy: 'Corrected by {{name}}',
      dayDetails: 'Day details',
      dayDetailsDescription:
        'Bookings, break balance, and correction context for the selected day.',
      timeline: 'Timeline',
      emptyDescription:
        'Change the period or filters to review another part of the timesheet.',
      dayActions: 'Day actions',
      correctMissingOrInaccurateBooking:
        'Please correct the missing or inaccurate booking for this day.',
      addBookingPair: 'Add booking pair',
      addBooking: 'Add booking',
      correctionRequestSubmitted: 'Correction request submitted.',
      unableToSubmitCorrectionRequest: 'Unable to submit correction request.',
      submitBookingCorrectionDescription:
        'Submit a booking correction for manager review.',
      needsAttention: 'Needs attention',
      correction: 'Correction',
      editDayBookings: 'Edit day bookings',
      editDayBookingsDescription:
        'Propose clock-ins, clock-outs, breaks, and work locations.',
      approvalRoute: 'Approval route',
      teamLead: 'Team lead',
      autoApprovedByPolicy: 'Auto-approved by policy',
      autoApprovedAuditHint:
        'This change is applied automatically and retained in the audit trail.',
      hrReview: 'HR review',
      eventsCount: '{{count}} events',
      event: 'Event',
      selectEventType: 'Selected event type: {{type}}',
      addEventType: 'Add {{type}} event',
      time: 'Time',
      workLocation: 'Work location',
      removeEvent: 'Remove event',
      submitChanges: 'Submit changes',
      timesheetChangeAutoApproved: 'Timesheet change auto-approved.',
      submitCorrection: 'Submit correction',
      currentBookings: 'Current bookings',
      currentBookingsDescription:
        'This is what Timesheet currently shows for the selected day.',
      correctClockIn: 'Correct clock-in',
      correctClockOut: 'Correct clock-out',
      correctionReasonExample:
        'Example: I forgot to clock out after leaving the office.',
      correctionWorkflowHint:
        'The correction is saved locally, queued for sync, and appears under Requests for manager approval. The original clock events are not changed until a real approval workflow applies the correction.',
      noRowsInThisView: 'No timesheet rows in this view',
      openActionsForDay: 'Open actions for {{day}}',
      previousPeriod: 'Previous period',
      nextPeriod: 'Next period',
      signedByOn: 'Signed by {{name}} on {{date}}',
      signingLocksActions:
        'Signing locks correction actions for this month and creates a syncable approval record.',
      onlyAuthorizedCanSign:
        'Only authorized managers, HR, and administrators can sign another employee timesheet.',
      optionalSignOffNote: 'Optional sign-off note',
      signMonth: 'Sign month',
      resolveExceptionsBeforeSignOff: 'Resolve exception rows before sign-off.',
      reviewExceptionsBeforeSignOff:
        'Review {{count}} exception rows before sign-off',
      noBookings: 'No bookings',
      open: 'open',
      overtimeShort: 'OT',
      weekend: 'Weekend',
      workday: 'Workday',
      today: 'Today',
      yesterday: 'Yesterday',
      myTimesheets: 'My timesheets',
      timelineLedgerDescription:
        'Daily clock-ins, breaks, overtime, and flex in chronological order.',
      legendWorkingTime: 'Working time',
      legendBreak: 'Break',
      legendOvertime: 'Overtime',
      legendLate: 'Late',
      badges: {
        corrected: 'Corrected',
        holiday: 'Holiday',
        homeOffice: 'Home office',
        longBreak: 'Long break',
        missing: 'Missing',
        negativeFlex: 'Negative flex',
        planned: 'Planned',
        plusFlex: 'Plus flex',
        weekend: 'Weekend',
      },
      exportStatus: {
        corrected: 'Corrected',
        publicHoliday: 'Public holiday',
        weekend: 'Weekend',
        workday: 'Workday',
      },
      unknownEmployeeLabel: 'Unknown employee',
      tabLedger: 'Ledger',
      tabSignOff: 'Sign-off',
      tabSummary: 'Summary',
      tabMonth: 'Month',
      tabWeek: 'Week',
      tabExceptions: 'Exceptions',
      exceptionsOnly: 'Only exceptions',
      rowsShown: 'Days shown: {{count}}',
      noExceptionsInPeriod: 'No exceptions in this period.',
      vacationYear: 'Vacation {{year}}',
      vacationAnnualLeave: 'Annual leave',
      vacationDisability: 'Due to disability',
      vacationExtraHoliday1: 'Extra holiday 1',
      vacationExtraHoliday2: 'Extra holiday 2',
      vacationFromPreviousYear: 'From previous year',
      vacationExpired: 'Expired',
      vacationTaken: 'Taken',
      vacationRemaining: 'Remaining vacation',
      vacationPlanned: 'Planned',
      vacationAvailable: 'Available',
    },
    errorsUi: {
      goBack: 'Go back',
      backToHome: 'Back to home',
      unauthorizedTitle: 'Unauthorized Access',
      unauthorizedDescription:
        'Please log in with the appropriate credentials to access this resource.',
      forbiddenTitle: 'Access Forbidden',
      forbiddenDescription:
        "You don't have necessary permission to view this resource.",
      notFoundTitle: 'Page not found',
      notFoundDescription:
        'This FlowPro page does not exist anymore, or your current role cannot open it.',
      generalTitle: 'FlowPro could not load this page',
      generalDescription:
        'The app hit an unexpected state. Go back or return home and try the action again.',
      somethingWentWrong: 'Something went wrong!',
      contentNotFound: 'Content not found.',
      contentNotModified: 'Content not modified.',
      sessionExpired: 'Your session expired. Sign in again to continue.',
      // Referenced by the shared API error resolver for every 403. This key was
      // missing while the Today screen already used it, so the raw key string
      // was rendered to users on any permission failure.
      forbidden: 'You do not have permission to do this.',
      routeErrorTitle: 'This page could not be displayed',
      routeErrorDescription:
        'Something went wrong while rendering this page. The rest of FlowPro is still available.',
      routeErrorDataDescription:
        'This page could not load its data. Check your connection and try again.',
      tryAgain: 'Try again',
      internalServerError: 'Internal server error.',
      maintenanceTitle: 'Website is under maintenance!',
      maintenanceDescription:
        "The site is not available at the moment. We'll be back online shortly.",
    },
    reportsUi: {
      worked: 'Worked',
      clockedProductiveHours: 'Clocked productive hours',
      paid: 'Paid',
      payrollRelevantPaidHours: 'Payroll-relevant paid hours',
      paidMinusTargetHours: 'Paid minus target hours',
      locked: 'Locked',
      openMonthlyPeriods: '{{count}} open monthly periods',
      notExported: 'Not exported',
      breakIssues: 'Break issues',
      legalBreakComplianceWarnings: 'Legal break compliance warnings',
      payrollPackage: 'Payroll package',
      exportVisibleEmployeeSet:
        'Export the currently visible employee set for {{periodMonth}}.',
      excel: 'Excel',
      pdf: 'PDF',
      signVisiblePeriods: 'Sign visible periods',
      payroll: 'Payroll',
      breakCompliance: 'Break compliance',
      absenceBalances: 'Absence balances',
      teams: 'Teams',
      monthlyApprovals: 'Monthly approvals',
      monthlyApprovalsDescription:
        'Signed periods are locked for correction and ready for payroll export.',
      team: 'Team',
      exports: 'Exports',
      loadingReports: 'Loading reports...',
      signedAndLocked: 'Signed and locked',
      openPeriod: 'Open period',
      yes: 'Yes',
      no: 'No',
      legalBreakCompliance: 'Legal break compliance',
      legalBreakComplianceDescription:
        'Days above six or nine worked hours must satisfy required break time.',
      exportEvidence: 'Export evidence',
      required: 'Required',
      ok: 'OK',
      missingBreak: 'Missing break',
      noLegalBreakEntries: 'No legal break entries in this period.',
      absenceBalanceReport: 'Absence balance report',
      absenceBalanceReportDescription:
        'Vacation, sickness, and home-office usage from local requests.',
      exportCsv: 'Export CSV',
      annual: 'Annual',
      approved: 'Approved',
      planned: 'Planned',
      remaining: 'Remaining',
      sickness: 'Sickness',
      noAbsenceBalances: 'No absence balances in this period.',
      managerTeamReport: 'Manager team report',
      managerTeamReportDescription:
        'Team-level payroll readiness, flex, capacity, and compliance.',
      headcount: 'Headcount',
      signed: 'Signed',
      open: 'Open',
      absenceDays: 'Absence days',
      noTeamReportRows: 'No team report rows in this period.',
      reportExportGenerated: 'Report export generated.',
      allVisiblePeriodsAlreadySigned: 'All visible periods are already signed.',
      signedFromReportsPayroll: 'Signed from Reports / Payroll.',
      visibleMonthlyPeriodsSignedLocked:
        'Visible monthly periods signed and locked.',
      monthlySignOff: 'Monthly sign-off',
      compliance: 'Compliance',
      reportsPayroll: 'Reports & payroll',
      reportsPayrollDescription:
        'Export payroll-ready time records, break compliance, absence balances, and team summaries.',
      period: 'Period',
      accessRestricted: 'Reports access restricted',
      accessRestrictedDescription:
        'Payroll reports are available to managers, HR, and administrators.',
      workdayFallback: 'Workday',
      nonWorkingDayFallback: 'Non-working day',
    },
    auditUi: {
      auditEvents: 'Audit events',
      auditEventsDescription: 'Request, user, policy, and access records',
      integrity: 'Integrity',
      valid: 'Valid',
      review: 'Review',
      chainedEventsChecked: '{{count}} chained events checked',
      privacyViews: 'Privacy views',
      privacyViewsDescription: 'Who opened sensitive audit surfaces',
      consentRecords: 'Consent records',
      consentRecordsDescription: 'Processing purposes tracked per employee',
      aggregateFilter: 'Audit aggregate',
      actorFilter: 'Audit actor',
      classificationFilter: 'Audit classification',
      dataRequests: 'Data requests',
      dataRequestsDescription: 'Export, rectify, restrict, delete workflows',
      auditTimeline: 'Audit timeline',
      auditTimelineDescription:
        'Filter and export audit evidence for HR/Admin review.',
      searchPlaceholder: 'Search actor, action, record, summary...',
      allRecords: 'All records',
      allActors: 'All actors',
      allSensitivity: 'All sensitivity',
      operational: 'Operational',
      personalData: 'Personal data',
      sensitive: 'Sensitive',
      system: 'System',
      when: 'When',
      actor: 'Actor',
      action: 'Action',
      record: 'Record',
      summary: 'Summary',
      loadingAuditEvents: 'Loading audit events',
      loadingAuditEventsDescription:
        'Verifying local audit records, privacy-access events, and integrity metadata.',
      noAuditEvents: 'No audit events match these filters',
      noAuditEventsDescription:
        'Widen the filters or clear the search to review more audit and privacy records.',
      resetFilters: 'Reset filters',
      sealed: 'sealed',
      legacy: 'legacy',
      whoSawWhat: 'Who saw what',
      whoSawWhatDescription:
        'Privacy-access events generated when sensitive audit surfaces are opened.',
      noPrivacyAccessEvents: 'No privacy-access events yet.',
      retentionModel: 'Retention model',
      retentionYears: '{{count}} years',
      dataSubjectRequests: 'Data subject requests',
      deleteIsGated: 'Delete is gated',
      deleteIsGatedDescription:
        'Personal data deletion must respect legal retention and is modeled as a review workflow, not an instant action.',
      deleteAllowedAfterRetentionReview:
        'Allowed only after deactivation and retention review.',
      immutableAuditChain: 'Immutable audit chain',
      privacyAccessLog: 'Privacy access log',
      globalAuditLog: 'Global audit log',
      globalAuditLogDescription:
        'Investigate request, user, policy, and privacy-access events with exportable evidence.',
      policySettings: 'Policy settings',
      auditAccessRestricted: 'Audit access restricted',
      auditAccessRestrictedDescription:
        'Only HR/Admin roles can view full audit events and privacy governance records.',
      auditIntegrityNeedsReview: 'Audit integrity needs review',
      hrAdminRole: 'HR/Admin',
      openedGlobalPrivacyAuditLog:
        '{{name}} opened the global privacy audit log.',
    },
    teamAvailabilityUi: {
      accessRestricted: 'Team availability access restricted',
      accessRestrictedDescription:
        'Team availability is limited to managers, HR, and administrators. Employees only see availability information where a policy-backed workflow needs it.',
      availabilityForDate:
        'Availability for {{date}} with privacy-aware details.',
      openPlanning: 'Open planning',
      export: 'Export',
      capacity: 'Capacity',
      fteAvailableToday: 'FTE available today',
      remote: 'Remote',
      workingOutsideOffice: 'Working outside office',
      conflicts: 'Conflicts',
      belowStaffingRule: 'Below staffing rule',
      returningSoon: 'Returning soon',
      withinNext7Days: 'Within the next 7 days',
      privacyByDefault: 'Privacy by default',
      privacyByDefaultDescription:
        'Teammates see availability state only. Managers see operational planning details where policy allows. Confidential absence reasons stay hidden.',
      managePolicy: 'Manage policy',
      loading: 'Loading team availability',
      loadingDescription:
        'Preparing availability, return dates, capacity warnings, and policy-safe details.',
      overview: 'Overview',
      heatmap: 'Heatmap',
      unavailable: 'Unavailable',
      searchPlaceholder: 'Search people or team...',
      everyoneAvailable: 'Everyone in this filtered view is available.',
      noReturns: 'No returns in the next 7 days.',
      adjustSearchDescription:
        'Adjust the search, team filter, or planning window to inspect another availability set.',
      managerWarnings: 'Manager warnings',
      staffingConflicts14Days: 'Staffing conflicts across the next 14 days.',
      conflictsCount: '{{count}} conflicts',
      clear: 'Clear',
      noStaffingWarnings: 'No staffing warnings for this filtered team view.',
      exactlyMinimumStaffing:
        'Exactly at minimum staffing: {{current}}/{{minimum}}.',
      noCapacityRows: 'No capacity rows for this filter',
      noCapacityRowsDescription:
        'Try a broader team search to see staffing, remote work, and minimum coverage rows.',
      scheduled: 'Scheduled',
      available: 'Available',
      minimum: 'Minimum',
      decision: 'Decision',
      statusAvailable: 'Available',
      statusRemote: 'Remote',
      statusUnavailable: 'Unavailable',
      statusAbsent: 'Absent',
      capacityStatus: {
        conflict: 'Conflict',
        healthy: 'Healthy',
        tight: 'Tight',
      },
      onsite: 'onsite',
      departmentHeatmap: 'Department heatmap',
      heatmapDescription:
        'Green is healthy, amber is at minimum, red needs manager action.',
      healthy: 'Healthy',
      tight: 'Tight',
      conflict: 'Conflict',
      staff: 'staff',
      noSchedule: 'no schedule',
      noPeopleInAvailabilityView: 'No people in this availability view',
      visibleDetail: 'Visible detail',
      until: 'Until',
      nextWorkingDay: 'Next working day',
      workPattern: 'Work pattern',
      csvHeaders: {
        date: 'Date',
        team: 'Team',
        scheduled: 'Scheduled',
        available: 'Available',
        remote: 'Remote',
        unavailable: 'Unavailable',
        capacityFte: 'Capacity FTE',
        minimumStaff: 'Minimum staff',
        minimumOnsite: 'Minimum onsite',
        status: 'Status',
        warnings: 'Warnings',
      },
    },
    planningUi: {
      accessRestricted: 'Planning access restricted',
      accessRestrictedDescription:
        'Workforce planning contains operational team capacity, coverage, and approval impact data. Employees can use Requests and My Time for their own workflow.',
      subtitle:
        'Plan personal absences and understand team availability in one place.',
      remoteDays: 'Remote days',
      leaveDays: 'Leave days',
      approvedOrPlanned: 'Approved or planned',
      capacityForecast: 'Capacity forecast',
      confidential: 'Confidential',
      detailsHiddenByPolicy: 'Details hidden by policy',
      loading: 'Loading planning data',
      loadingDescription:
        'Preparing calendars, policy masking, capacity forecast, and approval impact simulation.',
      myCalendar: 'My calendar',
      teamCalendar: 'Team calendar',
      forecast: 'Forecast',
      cover: 'Cover',
      impact: 'Impact',
      calendarOwner: 'Calendar owner',
      switchBetweenPeople: 'Switch between people with access.',
      reviewRequests: 'Review requests',
      personalPlanningYearStarting: 'Personal planning year starting',
      teamAvailabilityDescription:
        'Monthly overview with pending and confidential absences.',
      searchTeam: 'Search team...',
      capacityForecastDescription:
        'Forecast based on work patterns, holidays, requests, and staffing rules.',
      schedulingModel: 'Scheduling model',
      schedulingModelDescription:
        'Current work-pattern assumptions used by the forecast.',
      workdays: 'Workdays',
      onDemand: 'On demand',
      forecastConflictsNeedReview:
        '{{count}} forecast conflicts need manager review.',
      whoCanCoverThisDay: 'Who can cover this day?',
      selectedTeam: 'Selected team',
      noCoverCandidates: 'No cover candidates for this day',
      noCoverCandidatesDescription:
        'Try another team or date, or review the staffing rule before approving more absences.',
      capacityValue: 'Capacity {{value}} FTE',
      noApprovalImpact: 'No approval impact to simulate',
      noApprovalImpactDescription:
        'Pending absence and home-office requests will appear here so managers can review staffing impact before approving.',
      belowMinimumStaffingSentence:
        '{{team}} is below minimum staffing: {{current}}/{{minimum}}.',
      requiredOnsiteStaffSentence:
        '{{team}} has {{current}}/{{minimum}} required on-site staff.',
      noConflict: 'No conflict',
      staffed: 'staffed',
      openApprovalQueue: 'Open approval queue',
      people: 'People',
      calendarWeek: 'Calendar week',
      calendarWeekShort: 'CW',
      day: 'Day',
      weekday: 'Weekday',
      vacationPlanned: 'Vacation planned',
      homeOfficeDays: 'Home office days',
      pendingLabel: 'Pending',
      absenceLabels: {
        homeOffice: 'Home office',
        vacation: 'Vacation',
        sickLeave: 'Sick leave',
        timeOff: 'Time off',
        unavailable: 'Unavailable',
      },
      fit: {
        strong: 'strong',
        possible: 'possible',
        unavailable: 'unavailable',
      },
      csvHeaders: {
        date: 'Date',
        employee: 'Employee',
        team: 'Team',
        role: 'Role',
        dayType: 'Day type',
        statusCode: 'Status code',
        status: 'Status',
        category: 'Category',
        pending: 'Pending',
        confidential: 'Confidential',
        holiday: 'Holiday',
      },
      fallbackStatus: 'Status {{code}}',
      workPatternLabels: {
        partTime: 'Part-time',
        onDemand: 'On demand',
        hybrid: 'Hybrid',
        officeFirst: 'Office first',
        fullTime: 'Full-time',
      },
      coverageReasons: {
        notScheduledByWorkPattern: 'Not scheduled by work pattern',
        alreadyUnavailable: 'Already unavailable',
        sameTeamAndAvailable: 'Same team and available',
        availableCrossTeamCover: 'Available cross-team cover',
      },
    },
    attendanceUi: {
      approvalAutomation: 'Approval automation',
      approvalAutomationDescription:
        'Auto-approved changes remain audited and visible in Requests.',
      autoApproveBookingCorrections: 'Auto-approve booking corrections',
      autoApproveCorrectionThreshold: 'Minor correction threshold, minutes',
      autoApproveCorrectionThresholdDescription:
        'Only booking corrections at or below this total time change can auto-approve.',
      autoApproveNonRequiredAbsences:
        'Auto-approve absence types that do not require approval',
      attendancePolicies: 'Attendance policies',
      attendancePoliciesDescription:
        'Manage absence/status types and privacy visibility for managers, teammates, HR, and administrators.',
      privacyDescription:
        'Attendance data can reveal personal information such as work patterns, leave dates, and sickness. Configure the narrowest useful visibility for each status type and keep full details for HR/Admin audit use.',
      policyChangesLocked: 'Policy changes are locked',
      statuses: 'Statuses',
      rulesEngine: 'Rules engine',
      visibility: 'Visibility',
      absenceStatusTypes: 'Absence and status types',
      absenceStatusTypesDescription:
        'Create, update, or remove the codes available in requests and calendars.',
      newStatus: 'New status',
      code: 'Code',
      name: 'Name',
      category: 'Category',
      teammate: 'Teammate',
      hrAdmin: 'HR/Admin',
      loadingPolicies: 'Loading attendance policies',
      loadingPoliciesDescription:
        'Preparing status types, visibility rules, holiday calendars, and policy validation settings.',
      deleteStatusQuestion: 'Delete {{label}}?',
      deleteStatusDescription:
        'This removes the status from new requests and planning views. Existing synced history should stay auditable in the backend.',
      keepStatus: 'Keep status',
      policyRulesEngine: 'Policy rules engine',
      policyRulesEngineDescription:
        'One place for legal breaks, holiday calendars, working-time defaults, vacation carryover, and sensitive sickness handling.',
      legalBreakRules: 'Legal break rules',
      rulesEvaluatedDescription: 'Rules evaluated against worked time',
      holidayCalendar: 'Holiday calendar',
      vacationEntitlement: 'Vacation entitlement',
      beforeCarryoverUsage: 'Before carryover and usage',
      countryRegion: 'Country / region',
      holidayLocalScope: 'Holiday and local rule scope',
      weeklyHours: 'Weekly hours',
      defaultWorkingTimeContract: 'Default working-time contract',
      carryover: 'Carryover',
      appliedBeforeVisibility: 'Applied before visibility rules',
      breakRules: 'Break rules',
      afterHoursRule: 'After {{hours}}h: {{minutes}}m',
      editRules: 'Edit rules',
      holidayCalendarDescription:
        'Statutory and company days used by timesheets and planning.',
      workingTimeModel: 'Working-time model',
      workingTimeModelDescription:
        'Default contract created when an employee has no explicit contract yet.',
      workdays: 'Workdays',
      off: 'Off',
      rulePreview: 'Rule preview',
      rulePreviewDescription:
        'Example checks that the request workflow can consume before submission or approval.',
      vacationDaysRemaining: '{{count}} vacation days remaining',
      carryoverSummary:
        'Includes {{available}} carryover days. Expired: {{expired}}.',
      sicknessVisibilityPreview: 'Sickness visibility preview',
      visibilityModel: 'Visibility model',
      visibilityModelDescription:
        'The app should expose only the information required by each viewer role.',
      viewer: 'Viewer',
      visibleInformation: 'Visible information',
      visibilityHidden: 'Hidden',
      visibilityStateOnly: 'State only',
      visibilityOperational: 'Operational details',
      visibilityFull: 'Full details',
      categoryRemote: 'Remote',
      categoryLeave: 'Leave',
      categoryUnavailable: 'Unavailable',
      categorySickness: 'Sickness',
      categoryCustom: 'Custom',
      viewerEmployee: 'Employee',
      viewerTeammate: 'Teammate',
      viewerManager: 'Manager',
      viewerHrAdmin: 'HR/Admin',
      defaultTypeHomeOffice: 'Home office',
      defaultTypeVacation: 'Vacation',
      defaultTypeUnavailable: 'Unavailable',
      defaultTypeSickLeave: 'Sick leave',
      companyClosingDay: 'Company closing day',
      vacationBalanceExceededTitle: 'Vacation balance exceeded',
      vacationBalanceExceededMessage:
        'Request needs {{requestedDays}} days, but only {{remainingDays}} days are available.',
      carryoverExpiredTitle: 'Carryover expired',
      carryoverExpiredMessage:
        '{{carryoverExpiredDays}} carryover days are no longer usable after the company expiry date.',
      sicknessPrivacyEnforcedTitle: 'Sickness privacy enforced',
      sicknessPrivacyEnforcedMessage:
        'Teammates cannot see this status. Managers see availability state only; HR/Admin keeps the audit detail.',
      visibilityModelEmployee:
        'Own detailed bookings, request reasons, and decision history.',
      visibilityModelTeammate:
        'Available, unavailable, or remote only where policy allows.',
      visibilityModelManager:
        'Approved operational details required for planning.',
      visibilityModelHrAdmin:
        'Full request details, audit trail, policy configuration.',
      updateAbsenceStatusType: 'Update absence/status type',
      createAbsenceStatusType: 'Create absence/status type',
      statusTypeDrawerDescription:
        'Configure the code, category, visibility, approval, and audit rules used across requests, planning, and timesheets.',
      localFirstPolicyMeta:
        'Local-first change. Saved policy updates are queued for sync and audit.',
      reset: 'Reset',
      createStatus: 'Create status',
      color: 'Color',
      teammatesSee: 'Teammates see',
      managersSee: 'Managers see',
      hrAdminSee: 'HR/Admin see',
      requiresApproval: 'Requires approval',
      auditRequired: 'Audit required',
      updateAttendanceRules: 'Update attendance rules',
      updateAttendanceRulesDescription:
        'Maintain the company policy defaults used by requests, timesheets, planning, compliance checks, and privacy handling.',
      savedRulesMeta:
        'Saved rules update the local policy store and are queued for sync.',
      saveRules: 'Save rules',
      periodGovernance: 'Period governance',
      periodGovernanceDescription:
        'Control how far back and forward each module may navigate.',
      monthsBack: 'Months back',
      monthsForward: 'Months forward',
      country: 'Country',
      region: 'Region',
      defaultWeeklyHours: 'Default weekly hours',
      defaultWorkdays: 'Default workdays',
      addWorkday: 'Add workday',
      noDefaultWorkdays: 'No default workdays selected.',
      clearWorkdays: 'Clear workdays',
      allowVacationCarryover: 'Allow vacation carryover',
      maxCarryoverDays: 'Max carryover days',
      carryoverExpiry: 'Carryover expiry',
      carryoverExpiryPlaceholder: 'DD.MM',
      daysCount: '{{count}} days',
      expiresOn: 'Expires {{date}}',
      unableToSaveAttendanceType: 'Unable to save attendance type.',
      unableToDeleteAttendanceType: 'Unable to delete attendance type.',
      attendancePolicyRulesSaved: 'Attendance policy rules saved.',
      unableToSaveAttendancePolicyRules:
        'Unable to save attendance policy rules.',
      sicknessPrivacy: 'Sickness privacy',
      sicknessPrivacyMode: 'Sickness privacy mode',
      medicalConfidential: 'Medical confidential',
      managerOperational: 'Manager operational',
      standardVisibility: 'Standard visibility',
      currentTeam: 'Current team',
      configuredManager: 'Configured manager',
      fullTime40h: 'Full-time · 40h',
      currentSession: 'Current session',
      legalBreakRulesDescription:
        'These rules are evaluated by timesheets and compliance reports.',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
    },
    usersUi: {
      selectAllRows: 'Select all rows',
      selectRow: 'Select row',
      person: 'Person',
      contact: 'Contact',
      team: 'Team',
      manager: 'Manager',
      status: 'Status',
      role: 'Role',
      workPattern: 'Work pattern',
      activity: 'Activity',
      invitationPending: 'Invitation pending',
      reviewDate: 'Review {{date}}',
      lifecycle: {
        active:
          'Active access. Historical records remain linked to this employee.',
        invited: 'Access starts only after invitation acceptance.',
        retention: 'Retain historical attendance until {{date}}.',
        suspended:
          'Access is blocked until an administrator completes the review.',
      },
      filterUsers: 'Filter users...',
      active: 'Active',
      inactive: 'Inactive',
      invited: 'Invited',
      suspended: 'Suspended',
      noEmployeesMatch: 'No employees match this view',
      noEmployeesMatchDescription:
        'Clear the search or adjust table filters to bring employees back into the directory.',
      openMenu: 'Open menu',
      reactivate: 'Reactivate',
      resendInvitation: 'Resend invitation',
      invitationResent: 'We sent a new invitation link to {{email}}.',
      deactivate: 'Deactivate',
      employeeSaved: 'Employee saved.',
      unableSaveEmployee: 'Unable to save employee.',
      employeeDeactivated:
        'Employee deactivated. Historical records are retained.',
      unableDeactivateEmployee: 'Unable to deactivate employee.',
      employeeReactivated: 'Employee reactivated.',
      unableReactivateEmployee: 'Unable to reactivate employee.',
      invitationQueued: 'Invitation queued.',
      unableInviteEmployee: 'Unable to invite employee.',
      delegationUpdated: 'Delegation updated.',
      unableSaveDelegation: 'Unable to save delegation.',
      editEmployeeAccess: 'Edit employee access',
      createEmployeeProfile: 'Create employee profile',
      employeeProfileDescription:
        "Keep role, team, manager, and visibility aligned with the employee's real planning responsibility.",
      newEmployee: 'New employee',
      lastUpdated: 'Last updated {{date}}',
      localFirstChange:
        'Local-first change. Saved records are queued for sync.',
      saveChanges: 'Save changes',
      firstName: 'First Name',
      firstNamePlaceholder: 'John',
      lastName: 'Last Name',
      lastNamePlaceholder: 'Doe',
      username: 'Username',
      usernamePlaceholder: 'john_doe',
      emailPlaceholder: 'john.doe@gmail.com',
      phoneNumber: 'Phone Number',
      phonePlaceholder: '+123456789',
      selectRole: 'Select a role',
      teamPlaceholder: 'Operations',
      managerPlaceholder: 'Anna Queen',
      workPatternPlaceholder: 'Full-time · Flex',
      visibility: 'Visibility',
      selectVisibleData: 'Select visible data',
      availabilityOnly: 'Availability only',
      teamPlanningDetails: 'Team planning details',
      requestDetailsAuditTrail: 'Request details and audit trail',
      policyIntegrationAdministration: 'Policy and integration administration',
      fullPlatformAdministration: 'Full platform administration',
      passwordPlaceholder: 'e.g., S3cur3P@ssw0rd',
      confirmPassword: 'Confirm Password',
      inviteEmployee: 'Invite employee',
      inviteEmployeeDescription:
        "Send a secure invitation and assign the minimum role needed for the employee's work.",
      invitation: 'Invitation',
      inviteMeta:
        'Creates a local invite record now and can be connected to email delivery when the backend is ready.',
      invite: 'Invite',
      inviteEmailPlaceholder: 'anna.queen@company.com',
      descriptionOptional: 'Description (optional)',
      descriptionPlaceholder:
        'Add onboarding context or the first team assignment',
      addEmployee: 'Add employee',
      adminWorkspace: 'Admin workspace',
      privacyAwareAccess: 'Privacy-aware access',
      peopleAndAccess: 'People and access',
      peopleAndAccessDescription:
        'Manage employees, managers, HR access, and the visibility each role needs for attendance planning.',
      readOnlyAccess: 'Read-only access',
      readOnlyAccessDescription:
        'Your role can view limited employee availability, but cannot create, update, or remove employee access.',
      directory: 'Directory',
      permissions: 'Permissions',
      loadingEmployeeDirectory: 'Loading employee directory',
      loadingEmployeeDirectoryDescription:
        'Preparing people, teams, lifecycle status, credentials, and effective permissions.',
      activeEmployees: 'Active employees',
      activeEmployeesDescription: 'People currently included in planning',
      managersDescription: 'Can see operational planning details',
      privilegedAccess: 'Privileged access',
      privilegedAccessDescription: 'Admin and HR audit-level users',
      pendingInvites: 'Pending invites',
      pendingInvitesDescription: 'Need onboarding completion',
      approvalDelegation: 'Approval delegation',
      approvalDelegationDescription:
        'Configure manager substitution teams for approvals and request queue visibility.',
      selectManager: 'Select manager',
      addDelegatedTeam: 'Add delegated team',
      noDelegatedTeams: 'No delegated teams selected.',
      clearTeams: 'Clear teams',
      saveDelegation: 'Save delegation',
      noUsersAvailable: 'No users available',
      noUsersAvailableDescription:
        'Create or import employees before inspecting effective permissions and access scope.',
      effectivePermissions: 'Effective permissions',
      frontendContract: 'Frontend contract',
      signedInSession: 'Signed-in session',
      effectivePermissionsDescription:
        'Role permissions are calculated with lifecycle status before the UI enables sensitive actions. A backend can use the same DTO contract.',
      grantedPermissions: 'Granted permissions',
      sourceRoleLifecycle: 'Source: {{role}} role plus lifecycle policy',
      lifecyclePolicy: 'Lifecycle policy',
      accessBlockedByLifecycle: 'Access blocked by lifecycle status',
      granted: 'Granted',
      blocked: 'Blocked',
      whatUserCanDo: 'What this user can do',
      noActivePermissions:
        'No active permissions. The user is not production-enabled.',
      whyActionsHidden: 'Why actions are hidden',
      inviteSelectedUsers: 'Invite selected users',
      activateSelectedUsers: 'Activate selected users',
      deactivateSelectedUsers: 'Deactivate selected users',
      invitingUsers: 'Inviting users...',
      invitedUsersCount: 'Invited {{count}} users',
      errorInvitingUsers: 'Error inviting users',
      reactivatedSelectedUsers: 'Reactivated {{count}} selected users.',
      deactivatedSelectedUsers: 'Deactivated {{count}} selected users.',
      bulkDeactivationReason: 'Bulk deactivation from people workspace',
      deactivateUser: 'Deactivate user',
      deactivateUserQuestion:
        'Deactivate {{username}}? The user keeps the role {{role}} for historical reporting, but sign-in and production permissions are disabled.',
      enterUsernameToConfirm: 'Enter username to confirm deactivation.',
      reason: 'Reason',
      optionalDeactivationReason:
        'Optional deactivation reason for the audit trail.',
      historicalRetention: 'Historical retention',
      historicalRetentionDescription:
        'Attendance, requests, approvals, and audit events stay linked to this employee. This is a lifecycle change, not a hard delete.',
      inspectUser: 'Inspect user',
      hrRole: 'HR',
      superadminRole: 'Superadmin',
      permissionGroups: {
        attendance: 'Attendance',
        requests: 'Requests',
        planning: 'Planning',
        timesheets: 'Timesheets',
        people: 'People',
        platform: 'Platform',
      },
      permissionLabels: {
        clockOwnTime: 'Clock own time',
        requestOwnCorrections: 'Request own corrections',
        createOwnRequests: 'Create own requests',
        approveTeamRequests: 'Approve team requests',
        viewFullRequestDetail: 'View full request detail',
        viewTeamPlanning: 'View team planning',
        manageCapacityRules: 'Manage capacity rules',
        viewOwnTimesheet: 'View own timesheet',
        viewTeamTimesheets: 'View team timesheets',
        approveTeamTimesheets: 'Approve team timesheets',
        exportPayrollData: 'Export payroll data',
        viewPeopleDirectory: 'View people directory',
        manageUsers: 'Manage users',
        deactivateUsers: 'Deactivate users',
        inspectEffectivePermissions: 'Inspect effective permissions',
        managePolicies: 'Manage policies',
        viewFullAudit: 'View full audit',
        manageLocalSyncData: 'Manage local sync data',
      },
      permissionDescriptions: {
        clockOwnTime: 'Clock in, clock out, and manage personal break state.',
        requestOwnCorrections:
          'Submit missing-time or clock-event correction requests.',
        createOwnRequests:
          'Request vacation, home office, and official absences.',
        approveTeamRequests:
          'Approve or reject requests for operationally managed teams.',
        viewFullRequestDetail:
          'See request reasons, attachments, audit detail, and policy context.',
        viewTeamPlanning:
          'See operational team availability and capacity forecasts.',
        manageCapacityRules:
          'Adjust minimum staffing and planning assumptions.',
        viewOwnTimesheet: 'Review personal monthly attendance and balances.',
        viewTeamTimesheets:
          'Review employee timesheets required for team approval.',
        approveTeamTimesheets: 'Sign and lock monthly team timesheets.',
        exportPayrollData: 'Generate payroll-ready attendance exports.',
        viewPeopleDirectory: 'Open the people and access workspace.',
        manageUsers: 'Create users, update roles, teams, and profile metadata.',
        deactivateUsers:
          'Remove access while retaining historical attendance records.',
        inspectEffectivePermissions:
          'See the final permissions after role and lifecycle rules apply.',
        managePolicies:
          'Maintain absence statuses, visibility, and attendance policies.',
        viewFullAudit:
          'Access sensitive audit events and historical request detail.',
        manageLocalSyncData:
          'Inspect, reset, import, export, and retry local-first data.',
      },
      permissionReasons: {
        roleGrants: '{{role}} role grants this permission.',
        roleDoesNotInclude: '{{role}} role does not include this permission.',
      },
      permissionLifecycle: {
        activeUsersReceivePermissions:
          'Active users receive permissions from their assigned role.',
        invited:
          'Invitation is pending, so no production permissions are active yet.',
        suspended:
          'Account is suspended. Access stays blocked until an administrator reviews it.',
        inactive:
          'Account is inactive. Historical records are retained, but access is disabled.',
      },
      auditSummaries: {
        profileUpdated: '{{name}} profile was updated.',
        deactivatedWithRetention:
          '{{name}} was deactivated with historical retention.',
        reactivated: '{{name}} was reactivated.',
      },
      localSessionActor: 'Local session',
      searchTeams: 'Search teams',
      noTeamsFound: 'No teams found.',
      searchManagers: 'Search managers',
      noManagersFound: 'No managers found.',
      searchWorkPatterns: 'Search work patterns',
      noWorkPatternsFound: 'No work patterns found.',
      organization: 'Organization',
      loadingOrganization: 'Loading organization setup',
      loadingOrganizationDescription:
        'Preparing role profiles, teams, managers, and work patterns.',
      roleProfiles: 'Role profiles',
      roleProfilesDescription:
        'Manage assignable role profiles that map to the system permission model.',
      teams: 'Teams',
      teamsDescription:
        'Maintain team ownership and selectable organization structure for employees.',
      workPatterns: 'Work patterns',
      workPatternsDescription:
        'Keep reusable work schedules consistent across employees and planning.',
      departments: 'Departments',
      departmentsDescription:
        'Departments available to teams and employee assignments.',
      locations: 'Locations',
      locationsDescription:
        'Office and regional locations for employee assignments.',
      managersDescriptionLong:
        'Managers are people records with a manager role. Configure their primary team ownership and delegated approval scope here.',
      code: 'Code',
      name: 'Name',
      timeZone: 'Time zone',
      baseRole: 'Base role',
      newDepartment: 'New department',
      newLocation: 'New location',
      newRoleProfile: 'New role profile',
      newTeam: 'New team',
      newWorkPattern: 'New work pattern',
      addManager: 'Add manager',
      primaryTeamOwnership: 'Primary team ownership',
      primaryTeamOwnershipDescription:
        'Teams directly assigned to this manager as operational owner.',
      noPrimaryTeams: 'No primary teams assigned',
      noPrimaryTeamsDescription:
        'Assign a manager to a team in the teams catalog to make ownership explicit.',
      delegatedTeams: 'Delegated teams',
      delegatedTeamsDescription:
        'Optional substitution teams this manager may approve or review.',
      organizationDrawerDescription:
        'Manage reusable catalog data for people, planning, and access workflows.',
      label: 'Label',
      description: 'Description',
      weeklyHours: 'Weekly hours',
      activeCatalogEntry: 'Active catalog entry',
      activeCatalogEntryDescription:
        'Archived entries stay in historical records but are no longer offered for new selections.',
      editDepartment: 'Edit department',
      editLocation: 'Edit location',
      editRoleProfile: 'Edit role profile',
      editTeam: 'Edit team',
      editWorkPattern: 'Edit work pattern',
      organizationSaved: 'Organization data saved.',
      organizationSaveFailed: 'Could not save organization data.',
      searchRoleProfiles: 'Search role profiles',
      noRoleProfilesFound: 'No role profiles found.',
      noManagersFoundDescription:
        'Create a manager or promote an existing employee to manage teams and approvals.',
      roleProfileDescriptions: {
        superadmin:
          'Full platform control including audit and local sync management.',
        admin:
          'Platform operations, configuration, and local-first maintenance.',
        hr: 'Sensitive employee, request, and audit access for people operations.',
        manager: 'Team approvals, planning visibility, and monthly sign-off.',
        employee: 'Self-service attendance, requests, and timesheet access.',
      },
      organizationAudit: {
        catalogUpdated: 'Organization catalog entry {{label}} was updated.',
      },
    },
    syncUi: {
      openSyncStatus: 'Open sync status',
      syncStatus: 'Sync status',
      localSync: 'Local sync',
      queueHealthDescription: 'Queue health for offline changes.',
      offline: 'Offline',
      conflict: 'Conflict',
      needsRetry: 'Needs retry',
      healthy: 'Healthy',
      pending: 'Pending',
      failed: 'Failed',
      online: 'Online',
      no: 'No',
      yes: 'Yes',
      lastSync: 'Last sync:',
      notSyncedYet: 'Not synced yet',
      retry: 'Retry',
      offlineQueueHint:
        'Changes are saved on this device and will sync automatically when the API is reachable again.',
      pendingQueueHint:
        'Local changes are waiting to sync. You can keep working while FlowPro retries in the background.',
      failedQueueHint:
        'Sync needs attention. Review queued items or retry when the connection is healthy.',
      localData: 'Local data',
      exportLocalData: 'Export local data',
      importLocalData: 'Import local data',
      resetLocalData: 'Reset local data',
      resetLocalFlowProDataQuestion: 'Reset local FlowPro data?',
      resetLocalDataDescription:
        'This clears IndexedDB on this device, including seeded users, requests, policies, clock events, sync metadata, and queued operations. The app will reload and recreate seed data.',
      cancel: 'Cancel',
      schemaMigration: 'Schema migration',
      upgradedFromToSession:
        'Upgraded from v{{fromVersion}} to v{{toVersion}} in this session.',
      noQueuedLocalChanges: 'No queued local changes.',
      queuedRecordHint: 'Local record {{record}}',
      details: 'Details',
      operationDetails: 'Operation details',
      inspectQueuedChangesDescription:
        'Inspect queued local-first changes before they are synced.',
      type: 'Type',
      status: 'Status',
      aggregate: 'Aggregate',
      record: 'Record',
      attempts: 'Attempts',
      created: 'Created',
      keepLocal: 'Keep local',
      acceptRemote: 'Accept remote',
      cancelOperation: 'Cancel operation',
      cancelQueuedChangeQuestion: 'Cancel this queued change?',
      cancelQueuedChangeDescription:
        'This removes the local queued change before it syncs. Use this only when the change should not be sent to FlowPro.',
      keepQueuedChange: 'Keep queued change',
      cancelQueuedChange: 'Cancel queued change',
      operationStatuses: {
        pending: 'Queued',
        syncing: 'Syncing',
        synced: 'Synced',
        failed: 'Needs retry',
        conflict: 'Conflict',
        cancelled: 'Cancelled',
      },
      operationTitles: {
        clockEventCreate: 'Time booking waiting to sync',
        clockEventUpdate: 'Time booking update waiting to sync',
        clockEventDelete: 'Time booking removal waiting to sync',
        requestSubmit: 'Request waiting to sync',
        requestApprove: 'Approval decision waiting to sync',
        requestReject: 'Rejection decision waiting to sync',
        requestCancel: 'Request cancellation waiting to sync',
        timesheetSign: 'Timesheet sign-off waiting to sync',
        timesheetExport: 'Timesheet export record waiting to sync',
        userInvite: 'User invitation waiting to sync',
        userUpdate: 'User update waiting to sync',
        userDeactivate: 'User deactivation waiting to sync',
        userReactivate: 'User reactivation waiting to sync',
        default: '{{type}} waiting to sync',
      },
      operationDescriptions: {
        pending: 'Queued safely on this device.',
        syncing: 'FlowPro is sending this change now.',
        failed: 'Sync failed. Review the error and retry when ready.',
        conflict: 'This change conflicts with server data and needs a choice.',
      },
      exportSuccess: 'Local FlowPro data exported',
      exportError: 'Could not export local FlowPro data',
      importSuccess: 'Local FlowPro data imported',
      importError: 'Could not import local FlowPro data',
      indexedDbUnavailable: 'IndexedDB is not available in this environment.',
      invalidLocalDataExport:
        'This file is not a valid FlowPro local data export.',
      closeOtherTabsBeforeUpgrade:
        'Close other FlowPro tabs so local data can finish upgrading.',
      closeOtherTabsBeforeReset:
        'Close other FlowPro tabs before resetting local data.',
      migrationNotes: {
        organizationCatalogs: {
          title: 'Organization catalogs',
          description:
            'Adds local master data for departments, locations, role profiles, teams, and work patterns.',
        },
        managerDelegations: {
          title: 'Manager delegations',
          description:
            'Adds persistent manager delegation/substitution rules for approval visibility and actions.',
        },
        attendancePolicyConfig: {
          title: 'Attendance policy config',
          description:
            'Adds a local store for company policy rules used by requests, planning, and timesheets.',
        },
      },
    },
    syncHealthUi: {
      title: 'Sync Health',
      description:
        'Operational view of local-first reads, projection hydration, and queued writes.',
      attentionRequired: 'Attention required',
      projectionHydrationNeedsAttention:
        'One or more projection feeds need attention.',
      onlineState: 'Online state',
      online: 'Online',
      offline: 'Offline',
      pendingOutbox: 'Pending outbox',
      lastSuccessfulSync: 'Last successful sync',
      serverCursor: 'Server cursor',
      projectionFeeds: 'Projection feeds',
      projectionFeedsDescription:
        'Backend-safe projection feeds applied into IndexedDB for immediate local reads.',
      hydrateProjections: 'Hydrate projections',
      hydrationComplete: 'Projection hydration complete',
      hydrationCompletedWithErrors:
        'Projection hydration completed with errors',
      hydrationFailed: 'Projection hydration failed',
      module: 'Module',
      items: 'Items',
      lastHydrated: 'Last hydrated',
      status: 'Status',
      healthy: 'Healthy',
      needsAttention: 'Needs attention',
      notHydrated: 'Not hydrated',
      never: 'Never',
      localStoreCounts: 'Local store counts',
      modules: {
        audit: 'Audit',
        requests: 'Requests',
        absences: 'Absences',
        notifications: 'Notifications',
        timesheets: 'Timesheets',
        users: 'Users',
        organizationCatalogs: 'Organization catalogs',
        employmentContracts: 'Employment contracts',
        planning: 'Planning',
        reports: 'Reports',
      },
    },
    qualityHealthUi: {
      title: 'Quality Health',
      description:
        'Operational quality view for bug SLA, sync risk, audit integrity, and local evidence.',
      attentionRequired: 'Attention required',
      attentionRequiredDescription:
        'One or more operational signals need review before feature work continues.',
      qualityScore: 'Quality score',
      qualityScoreDescription:
        'Derived from audit, sync, projection, and outbox health signals.',
      bugSla: 'Bug SLA',
      bugSlaDescription:
        'FlowPro keeps bugs visible and time-boxed instead of building a silent backlog.',
      bugDashboard: 'Bug dashboard',
      bugDashboardDescription:
        'Operational bug view derived from current quality signals until an issue tracker is connected.',
      openBugs: 'Open bugs',
      highSeverityBugs: 'High severity bugs',
      normalSeverityBugs: 'Normal severity bugs',
      oldestOpenBug: 'Oldest open bug',
      productAreas: 'Product areas',
      highSeverity: 'High severity',
      normalSeverity: 'Normal severity',
      hours: '{count} hours',
      days: '{count} days',
      openRisks: 'Open risks',
      failedOutbox: 'Failed outbox',
      serverHealth: 'Server health',
      projectionFailures: 'Projection failures',
      auditIntegrity: 'Audit integrity',
      valid: 'Valid',
      review: 'Review',
      operationalRisks: 'Operational risks',
      operationalRisksDescription:
        'Current risks that can make local-first data stale, incomplete, or legally unsafe.',
      noOperationalRisks: 'No operational risks detected.',
      severity: 'Severity',
      risk: 'Risk',
      action: 'Action',
      critical: 'Critical',
      warning: 'Warning',
      ok: 'OK',
      evidence: 'Evidence',
      serverOperations: 'Server operations',
      serverOperationsDescription:
        'Backend source-of-truth signals for projection, audit, and outbox processing.',
      backendReachability: 'Backend reachability',
      reachable: 'Reachable',
      unavailable: 'Unavailable',
      serverPendingOutbox: 'Server pending outbox',
      serverFailedOutbox: 'Server failed outbox',
      lastProcessedOutbox: 'Last processed outbox',
      lastAuditEvent: 'Last audit event',
      lastProjectionUpdate: 'Last projection update',
      serverCursor: 'Server projection count',
      lastServerError: 'Last server error',
      operationsHealthUnavailable:
        'Operations health is unavailable. Showing local quality signals only.',
      lastSuccessfulSync: 'Last successful sync',
      lastSyncError: 'Last sync error',
      localSchema: 'Local schema',
      newestFailedOutbox: 'Newest failed outbox',
      none: 'None',
      never: 'Never',
      unknown: 'Unknown',
      issues: {
        auditIntegrity: {
          title: 'Audit chain needs review',
          description:
            'Review audit evidence before relying on exports or payroll/legal records.',
        },
        offline: {
          title: 'Client is offline',
          description:
            'Verify connectivity before approving legal or payroll-sensitive workflows.',
        },
        failedOutbox: {
          title: 'Outbox has failed writes',
          description:
            'Retry, resolve, or cancel failed operations so backend state stays authoritative.',
        },
        pendingOutbox: {
          title: 'Outbox has pending writes',
          description:
            'Wait for sync or review queued operations before trusting refreshed projections.',
        },
        projectionErrors: {
          title: 'Projection hydration failed',
          description:
            'Hydrate projections again and inspect module errors in Sync Health.',
        },
        syncError: {
          title: 'Sync engine reported an error',
          description:
            'Open Sync Health and clear the sync error before shipping new workflow changes.',
        },
        serverHealthCritical: {
          title: 'Backend operations are unhealthy',
          description:
            'Resolve failed backend outbox processing before trusting legal or payroll evidence.',
        },
        serverHealthWarning: {
          title: 'Backend operations need review',
          description:
            'Check pending backend work and confirm projections catch up before release work continues.',
        },
        serverHealthUnavailable: {
          title: 'Backend operations health is unavailable',
          description:
            'Verify API reachability before relying on the local-first dashboard alone.',
        },
      },
    },
    accessUi: {
      permissionMessages: {
        'manage-users':
          'Only HR and administrators can manage employee access.',
        'manage-policies':
          'Only HR and administrators can change attendance policies.',
        'view-audit': 'Only HR and administrators can view full audit details.',
        'team-detail':
          'Managers see operational details for their team. Teammates see availability state only.',
      },
    },
    privacyUi: {
      retentionClockEvents: 'Working-time documentation and payroll defense.',
      retentionRequests:
        'Employment administration and absence planning history.',
      retentionAuditEvents:
        'Security, accountability, and change traceability.',
      retentionPayrollExports: 'Payroll and tax documentation.',
      hiddenByPolicy: 'Hidden by policy',
      confidentialAbsence: 'Confidential absence',
      onlyHrAdminEmployeeCanViewSensitive:
        'Only HR/Admin and the employee can view this sensitive request.',
      managerViewLimited:
        'Manager view is limited to operational planning detail. Reasons and attachments stay private.',
      teammateViewLimited: 'Teammate view is limited to availability state.',
      timeCorrection: 'Time correction',
      remote: 'Remote',
      unavailable: 'Unavailable',
    },
    usersValidation: {
      firstNameRequired: 'First Name is required.',
      lastNameRequired: 'Last Name is required.',
      usernameRequired: 'Username is required.',
      phoneRequired: 'Phone number is required.',
      emailRequired: 'Email is required.',
      teamRequired: 'Team is required.',
      managerRequired: 'Manager is required.',
      workPatternRequired: 'Work pattern is required.',
      visibilityRequired: 'Visibility scope is required.',
      roleRequired: 'Role is required.',
      passwordRequired: 'Password is required.',
      passwordLength: 'Password must be at least 8 characters long.',
      passwordLowercase: 'Password must contain at least one lowercase letter.',
      passwordNumber: 'Password must contain at least one number.',
      passwordMatch: "Passwords don't match.",
      inviteEmailRequired: 'Please enter an email to invite.',
    },
    settingsUi: {
      settings: 'Settings',
      settingsDescription:
        'Configure identity, account preferences, notifications, and attendance policy controls.',
      profile: 'Profile',
      account: 'Account',
      appearance: 'Appearance',
      notifications: 'Notifications',
      attendance: 'Attendance',
      notificationsDescription:
        'Choose which attendance, approval, sync, and security events should notify you.',
      notificationsUpdated: 'Notification preferences updated.',
      recentNotifications: 'Recent notifications',
      recentNotificationsDescription:
        'Server-synced alerts from approvals, requests, payroll, and sync.',
      unreadNotifications: '{{count}} unread',
      allRead: 'All read',
      markAllRead: 'Mark all read',
      loadingNotifications: 'Loading notifications...',
      noSyncedNotificationsYet: 'No synced notifications yet.',
      recently: 'Recently',
      markRead: 'Mark read',
      requestDecisions: 'Request decisions',
      requestDecisionsDescription:
        'Notify me when my leave, home-office, or correction requests are approved or rejected.',
      approvalQueue: 'Approval queue',
      approvalQueueDescription:
        'Notify managers when team requests need a decision.',
      timesheetExceptions: 'Timesheet exceptions',
      timesheetExceptionsDescription:
        'Notify me about missing clock-outs, break compliance issues, and unsigned periods.',
      offlineSyncFailures: 'Offline sync failures',
      offlineSyncFailuresDescription:
        'Notify me when local-first operations need attention or retry.',
      weeklyAttendanceSummary: 'Weekly attendance summary',
      weeklyAttendanceSummaryDescription:
        'Send a concise weekly digest of worked hours, flex balance, and upcoming absences.',
      securityEmails: 'Security emails',
      securityEmailsDescription:
        'Always send sign-in and account security events.',
      updateNotifications: 'Update notifications',
      display: 'Display',
      displayDescription:
        "Turn items on or off to control what's displayed in the app.",
      displayUpdated: 'Display preferences updated.',
      selectAtLeastOneDisplayPreference:
        'Select at least one display preference.',
      workSurface: 'Work surface',
      workSurfaceDescription:
        'Configure how much operational context FlowPro shows around core workflows.',
      updateDisplay: 'Update display',
      profileUpdated: 'Profile updated.',
      profileUpdateFailed: 'Your profile could not be updated. Try again.',
      preferencesSaveFailed: 'Your preferences could not be saved. Try again.',
      firstNameRequired: 'First name is required.',
      lastNameRequired: 'Last name is required.',
      usernameMinLength: 'Username must be at least 2 characters.',
      usernameMaxLength: 'Username must not be longer than 40 characters.',
      phoneNumberRequired: 'Phone number is required.',
      usernameDescription:
        'Used for audit labels, local records, and generated employee identifiers.',
      signInEmail: 'Sign-in email',
      signInEmailDescription:
        'Email belongs to the local sign-in identity. Change it from People and access when backend auth is connected.',
      phoneDescription: 'Optional operational contact for managers and HR.',
      updateProfile: 'Update profile',
      profileDescription:
        'This information appears in attendance views, approvals, team planning, and audit history.',
      accountDescription:
        'Review your signed-in identity and maintain local account preferences.',
      security: 'Security',
      securityDescription:
        'Manage your email address, password, and the devices signed in to your account.',
      emailAddress: 'Email address',
      emailConfirmed: 'Confirmed',
      emailNotConfirmed: 'Not confirmed',
      resendConfirmation: 'Send confirmation email',
      confirmationSent: 'We sent a confirmation link to {{email}}.',
      changeEmail: 'Change email address',
      changeEmailDescription:
        'We send a link to the new address. Your address changes when you open it; until then you keep signing in with the current one.',
      newEmail: 'New email address',
      emailChangeSent:
        'Check {{email}} and open the link we sent to finish the change.',
      changePassword: 'Change password',
      changePasswordDescription:
        'Changing your password signs out every other device. You stay signed in here.',
      currentPassword: 'Current password',
      passwordChanged:
        'Password changed. Other sessions signed out: {{count}}.',
      sessions: 'Signed-in devices',
      sessionsDescription:
        'End any session you do not recognise, then change your password.',
      signOutOtherSessions: 'Sign out everywhere else',
      otherSessionsEnded: 'Other sessions signed out: {{count}}.',
      endSession: 'Sign out',
      sessionEnded: 'That device was signed out.',
      thisDevice: 'This device',
      deviceName: '{{browser}} on {{os}}',
      unknownDevice: 'Unknown device',
      sessionDetails:
        'Signed in {{signedIn}} · last active {{lastSeen}} · IP {{ip}}',
      appearanceDescription:
        'Tune theme and typography for comfortable daily attendance work.',
      appearanceUpdated: 'Appearance preferences updated.',
      font: 'Font',
      fontDescription: 'Set the font used across FlowPro work surfaces.',
      theme: 'Theme',
      themeDescription: 'Select the theme for FlowPro.',
      light: 'Light',
      dark: 'Dark',
      updatePreferences: 'Update preferences',
      displayItems: {
        'density-compact': {
          label: 'Compact operational density',
          description: 'Use tighter rows in tables and planning surfaces.',
        },
        'show-sync': {
          label: 'Show sync status',
          description: 'Keep local-first sync state visible in the header.',
        },
        'show-policy-hints': {
          label: 'Show permission and policy hints',
          description: 'Explain why fields are hidden, disabled, or masked.',
        },
        'full-width-pages': {
          label: 'Use full-width work pages',
          description:
            'Prefer wide layouts for reports, planning, and timesheets.',
        },
      },
    },
    settings: {
      account: {
        signedInAs: 'Signed in as',
        role: 'Role',
        team: 'Team',
        manager: 'Manager',
        workPattern: 'Work pattern',
        selectLanguage: 'Select language',
        timesShownIn: 'Times shown in',
        selectTimezone: 'Select timezone',
        searchTimezone: 'Search time zones...',
        weekStartsOn: 'Week starts on',
        defaultWorkLocation: 'Default work location',
        updateAccount: 'Update account',
        updated: 'Account preferences updated.',
        languageDescription: 'Used for localized labels, emails, and exports.',
        timezoneDescription:
          'Used for clock events, request dates, and audit timestamps.',
      },
    },
  },
  de: {
    apiErrors: {
      account: {
        email_already_registered:
          'Für diese E-Mail gibt es bereits ein Konto. Melde dich stattdessen an.',
        email_rejected: 'Diese E-Mail-Adresse kann nicht verwendet werden.',
        password_rejected:
          'Wähle ein längeres Passwort, das nicht leicht zu erraten ist.',
        registration_disabled:
          'In dieser Installation können keine neuen Konten erstellt werden.',
        current_password_incorrect: 'Das aktuelle Passwort ist falsch.',
        session_current:
          'Melde dich ab, um die Sitzung zu beenden, die du gerade nutzt.',
        session_not_found: 'Diese Sitzung gibt es nicht mehr.',
        session_required:
          'Melde dich an, um eine Bestätigungs-E-Mail anzufordern.',
        token_invalid:
          'Dieser Link ist ungültig oder abgelaufen. Fordere einen neuen an.',
        email_invalid: 'Gib eine gültige E-Mail-Adresse ein.',
        email_unchanged: 'Das ist bereits deine E-Mail-Adresse.',
        email_taken:
          'Diese E-Mail-Adresse gehört inzwischen zu einem anderen Konto, deine Adresse bleibt unverändert.',
        workspace_not_found: 'Du gehörst nicht zu diesem Arbeitsbereich.',
        invitation_other_address:
          'Diese Einladung ging an eine andere E-Mail-Adresse. Melde dich mit dieser Adresse an, um sie anzunehmen.',
        two_factor_challenge_expired:
          'Die Anmeldung hat zu lange gedauert. Melde dich erneut mit deinem Passwort an.',
        two_factor_code_invalid:
          'Dieser Code ist falsch. Gib den aktuellen Code ein.',
        two_factor_already_enabled:
          'Die Anmeldung in zwei Schritten ist bereits an.',
        two_factor_not_enabled:
          'Die Anmeldung in zwei Schritten ist aus, deshalb gibt es keine Wiederherstellungscodes.',
        two_factor_setup_missing:
          'Richte deine Authenticator-App erneut ein und gib dann ihren Code ein.',
        shared_demo_account:
          'Dies ist ein geteilter Demo-Zugang, deshalb lassen sich seine Anmeldedaten nicht ändern.',
      },
      authentication: {
        invalid_credentials: 'E-Mail oder Passwort ist falsch.',
      },
      user: {
        invitation_not_open:
          'Diese Person meldet sich bereits an oder ihr Zugang ist geschlossen, daher gibt es keine Einladung zu senden.',
        shared_demo_login:
          'Diese Person ist einer der geteilten Demo-Zugänge und lässt sich weder ändern noch deaktivieren.',
      },
      'approval-flow': {
        'assigned-to-another-approver':
          'Dieser Antrag wartet auf eine andere genehmigende Person.',
        'current-step': {
          invalid: 'Dieser Genehmigungsschritt ist nicht mehr der aktuelle.',
        },
      },
      attachments: {
        'content-type-not-allowed':
          'Dieser Dateityp kann nicht angehängt werden.',
        'empty-file': 'Diese Datei ist leer.',
        'file-name-required': 'Die Datei benötigt einen Namen.',
        'file-too-large': 'Diese Datei ist zu groß für einen Anhang.',
        'metadata-invalid': 'Die Angaben zum Anhang sind ungültig.',
        'not-found': 'Dieser Anhang existiert nicht mehr.',
        'object-not-found': 'Die gespeicherte Datei wurde nicht gefunden.',
        'owner-required': 'Dem Anhang fehlt eine zugeordnete Person.',
        'permission-required':
          'Du hast keine Berechtigung, diesen Anhang zu ändern.',
        'read-permission-required':
          'Du hast keine Berechtigung, diesen Anhang zu öffnen.',
      },
      attendance: {
        'booking-already-voided': 'Diese Buchung wurde bereits storniert.',
        'booking-not-accessible': 'Du kannst diese Buchung nicht ändern.',
        'clock-in': {
          'invalid-state':
            'Du kannst nur einstempeln, bevor die Arbeit begonnen hat.',
        },
        'clock-out': {
          'invalid-state': 'Du kannst nur während der Arbeit ausstempeln.',
        },
        'correction-reason': {
          invalid: 'Gib einen Grund für diese Korrektur an.',
        },
        'device-sequence': {
          invalid:
            'Dieses Gerät hat Buchungen in falscher Reihenfolge gesendet. Bitte neu laden.',
        },
        'event-before-current-state':
          'Diese Zeit liegt vor deinem aktuellen Erfassungsstand.',
        geo: {
          'accuracy-invalid':
            'Die gemeldete Standortgenauigkeit ist unbrauchbar.',
          incomplete: 'Der Standort ist unvollständig.',
          invalid: 'Der gemeldete Standort ist ungültig.',
        },
        'invalid-range': 'Wähle einen gültigen Zeitraum.',
        'occurred-at-in-future': 'Du kannst keine Zeit in der Zukunft buchen.',
        'range-too-large':
          'Dieser Zeitraum ist zu groß. Bitte wähle einen kürzeren.',
        'resume-work': {
          'invalid-state':
            'Du kannst die Arbeit nur während einer Pause fortsetzen.',
        },
        'start-break': {
          'invalid-state':
            'Du kannst nur während der Arbeit eine Pause starten.',
        },
        'state-missing': 'Für diesen Tag wurde kein Erfassungsstand gefunden.',
      },
      employee: {
        'not-active': 'Dieses Mitarbeiterkonto ist nicht aktiv.',
      },
      'idempotency-key': {
        invalid:
          'Die Anfrage konnte nicht zugeordnet werden. Bitte erneut versuchen.',
        reused: 'Diese Aktion wurde bereits übermittelt.',
      },
      onboarding: {
        already_completed: 'Dieser Workspace wurde bereits eingerichtet.',
      },
      tenant: {
        country_code_invalid: 'Wähle ein gültiges Land.',
        region_code_invalid: 'Wähle eine gültige Region für das gewählte Land.',
        region_requires_country: 'Wähle zuerst ein Land, dann eine Region.',
      },
      payroll: {
        format: { invalid: 'Wähle ein unterstütztes Exportformat.' },
        period: { required: 'Wähle einen Abrechnungszeitraum.' },
      },
      request: {
        attachment: { 'too-large': 'Dieser Anhang ist zu groß.' },
        'booking-correction': {
          empty: 'Gib mindestens eine korrigierte Zeit an.',
        },
        'date-range': { invalid: 'Wähle einen gültigen Zeitraum.' },
        kind: { invalid: 'Wähle eine gültige Antragsart.' },
        'not-found': 'Dieser Antrag existiert nicht mehr.',
        'not-submitted': 'Dieser Antrag wurde noch nicht eingereicht.',
        'partial-day': { invalid: 'Die Auswahl für den Teiltag ist ungültig.' },
        payload: { invalid: 'Einige Antragsangaben sind ungültig.' },
        recurrence: { invalid: 'Das Wiederholungsmuster ist ungültig.' },
        'status-type': { required: 'Wähle eine Abwesenheitsart.' },
        subtype: { required: 'Wähle eine Unterart des Antrags.' },
      },
      status: {
        unavailable:
          'FlowPro ist vorübergehend nicht erreichbar. Versuche es gleich noch einmal.',
      },
      sync: {
        aggregate: { required: 'Der Sync-Datensatz fehlt.' },
        batch: {
          'too-large': 'Es wurden zu viele Änderungen auf einmal gesendet.',
        },
        'client-id': { required: 'Der Sync-Anfrage fehlt eine Client-ID.' },
        cursor: {
          invalid: 'Die Sync-Position ist ungültig. Bitte Sync wiederholen.',
        },
        protocol: {
          invalid:
            'Diese App-Version kann nicht mit dem Server synchronisieren.',
        },
      },
      timesheet: {
        period: { invalid: 'Wähle einen gültigen Zeiterfassungszeitraum.' },
      },
    },
    common: {
      resultsAnnouncement: '{{count}} Ergebnisse',
      language: 'Sprache',
      timezone: 'Zeitzone',
      save: 'Speichern',
      close: 'Schließen',
      closePanel: 'Seitenbereich schließen',
      update: 'Aktualisieren',
      cancel: 'Abbrechen',
      continue: 'Weiter',
      filter: 'Filtern...',
      loading: 'Lädt...',
      preparingLatestLocalData: 'Aktuelle lokale Daten werden vorbereitet.',
      reset: 'Zurücksetzen',
      search: 'Suchen',
      select: 'Auswählen',
      noResults: 'Keine Ergebnisse gefunden.',
      office: 'Büro',
      homeOffice: 'Homeoffice',
      monday: 'Montag',
      sunday: 'Sonntag',
      yes: 'Ja',
      no: 'Nein',
      or: 'oder',
      clearAll: 'Alle löschen',
      noItemsSelected: 'Keine Einträge ausgewählt.',
    },
    commandUi: {
      commandPalette: 'Befehlspalette',
      commandPaletteDescription: 'Nach einem Befehl suchen...',
      searchPlaceholder: 'Befehl eingeben oder suchen...',
      noMatchingAction: 'Keine passende FlowPro-Aktion gefunden.',
      people: 'Personen',
      myRequests: 'Meine Anträge',
      systemTheme: 'System',
    },
    dataTableUi: {
      bulkSelectionAnnouncement:
        '{{count}} {{entity}} ausgewählt. Die Sammelaktionen sind verfügbar.',
      bulkActionsForSelection:
        'Sammelaktionen für {{count}} ausgewählte {{entity}}',
      clearSelection: 'Auswahl aufheben',
      clearSelectionShortcut: 'Auswahl aufheben (Escape)',
      selectedCount: '{{count}} ausgewählt',
      selected: 'ausgewählt',
      noMatchingFilterOption: 'Keine passende Filteroption gefunden.',
      clearFilters: 'Filter löschen',
      view: 'Ansicht',
      toggleColumns: 'Spalten ein-/ausblenden',
      rowsPerPage: 'Zeilen pro Seite',
      pageOf: 'Seite {{page}} von {{total}}',
      previousPage: 'Vorherige Seite',
      nextPage: 'Nächste Seite',
      showingRange: '{{start}}-{{end}} von {{total}}',
      goToFirstPage: 'Zur ersten Seite',
      goToPreviousPage: 'Zur vorherigen Seite',
      goToPage: 'Zu Seite {{page}}',
      goToNextPage: 'Zur nächsten Seite',
      goToLastPage: 'Zur letzten Seite',
    },
    invitationUi: {
      title: '{{workspace}} beitreten',
      description: 'Diese Einladung ging an {{email}}.',
      loadingTitle: 'Einladung',
      loading: 'Einladung wird geöffnet...',
      invalidTitle: 'Diese Einladung funktioniert nicht',
      invalidDescription:
        'Öffne den Link aus der Einladungs-E-Mail erneut oder bitte um eine neue Einladung.',
      join: 'Dem Arbeitsbereich beitreten',
      signInToJoin:
        'Du hast bereits ein FlowPro-Konto mit {{email}}. Melde dich damit an, um beizutreten.',
      createAccount:
        'Wähle deinen Namen und ein Passwort. Du meldest dich ab jetzt mit {{email}} an.',
      createAndJoin: 'Konto erstellen und beitreten',
      otherAccountTitle: 'Mit einer anderen Adresse angemeldet',
      otherAccountDescription:
        'Diese Einladung ist für {{invited}}, du bist aber als {{signedIn}} angemeldet.',
      signOutAndContinue: 'Abmelden und fortfahren',
    },
    demoUi: {
      title: 'Demo ausprobieren',
      description:
        'Geteilte Zugänge: Alle sehen, was du eingibst, und die Demo wird täglich um {{time}} UTC zurückgesetzt.',
      signInAs: 'Als {{role}} anmelden',
      roles: {
        superadmin: 'Admin',
        manager: 'Führungskraft',
        employee: 'Mitarbeiter',
      },
      manualHint:
        'Oder melde dich unten mit der Adresse eines Zugangs und dem Passwort {{password}} an.',
      or: 'oder',
      sharedLogin:
        'Dies ist ein geteilter Demo-Zugang, deshalb lassen sich E-Mail, Passwort, Anmeldung in zwei Schritten und andere Geräte nicht ändern.',
    },
    twoFactorUi: {
      title: 'Anmeldung in zwei Schritten',
      description:
        'Bei der Anmeldung wird zusätzlich ein Code aus einer Authenticator-App auf deinem Handy abgefragt, damit ein gestohlenes Passwort allein nicht reicht.',
      on: 'An',
      off: 'Aus',
      setUp: 'Anmeldung in zwei Schritten einrichten',
      continue: 'Weiter',
      scanInstructions:
        'Scanne diesen QR-Code mit einer Authenticator-App, etwa Aegis, 2FAS, Google Authenticator oder Microsoft Authenticator. Gib dann den sechsstelligen Code ein, den sie anzeigt.',
      qrLabel: 'QR-Code für deine Authenticator-App',
      manualKey:
        'Scannen klappt nicht? Gib stattdessen diesen Schlüssel in der App ein:',
      code: 'Code aus der App',
      codeRequired: 'Gib den Code ein.',
      turnOn: 'Einschalten',
      turnedOn:
        'Die Anmeldung in zwei Schritten ist an. Abgemeldete andere Sitzungen: {{count}}.',
      saveCodes:
        'Bewahre diese Wiederherstellungscodes sicher auf, etwa in einem Passwortmanager. Jeder meldet dich einmal an, falls du dein Handy verlierst. Sie werden nur jetzt angezeigt.',
      copyCodes: 'Kopieren',
      codesCopied: 'Wiederherstellungscodes kopiert.',
      copyFailed:
        'Kopieren hat nicht geklappt. Markiere die Codes und kopiere sie von Hand.',
      downloadCodes: 'Herunterladen',
      codesFileHeading:
        'FlowPro-Wiederherstellungscodes. Jeder Code funktioniert einmal.',
      savedCodes: 'Ich habe sie gespeichert',
      recoveryCodesLeft: 'Unbenutzte Wiederherstellungscodes: {{count}}.',
      newRecoveryCodes: 'Neue Wiederherstellungscodes',
      turnOff: 'Ausschalten',
      turnedOff: 'Die Anmeldung in zwei Schritten ist aus.',
      signInTitle: 'Code eingeben',
      signInDescription:
        'Öffne deine Authenticator-App und gib den sechsstelligen Code für FlowPro ein.',
      signInRecoveryDescription:
        'Gib einen der Wiederherstellungscodes ein, die du beim Einrichten gespeichert hast.',
      recoveryCode: 'Wiederherstellungscode',
      verify: 'Bestätigen',
      useRecoveryCode: 'Stattdessen einen Wiederherstellungscode verwenden',
      useApp: 'Stattdessen die Authenticator-App verwenden',
    },
    profileUi: {
      localAccountEmail: 'angemeldet@flowpro.local',
      peopleWorkspace: 'Personen-Arbeitsbereich',
      signOut: 'Abmelden',
      workspaces: 'Arbeitsbereiche',
      switchingWorkspace: 'Arbeitsbereich wird gewechselt...',
      unsentChangesBlockSwitch:
        'Noch nicht gesendete Änderungen: {{count}}. Geh online oder kläre sie im Sync-Bereich, dann wechsle.',
      signOutDescription:
        'Möchtest du dich wirklich abmelden? Du musst dich erneut anmelden, um auf dein Konto zuzugreifen.',
    },
    configUi: {
      openThemeSettings: 'Design-Einstellungen öffnen',
      themeSettings: 'Design-Einstellungen',
      themeSettingsDescription:
        'Darstellung und Layout an deine Arbeitsweise anpassen.',
      resetAllSettings: 'Alle Einstellungen auf Standardwerte zurücksetzen',
      reset: 'Zurücksetzen',
      resetSection: '{{section}} zurücksetzen',
      selectOption: '{{option}} auswählen',
      optionPreview: 'Vorschau für {{option}}',
      toggleTheme: 'Design umschalten',
      toggleSidebar: 'Seitenleiste umschalten',
      selectThemePreference: 'Design-Voreinstellung auswählen',
      themeDescription:
        'Zwischen Systemeinstellung, hellem Modus und dunklem Modus wählen',
      sidebar: 'Seitenleiste',
      selectSidebarStyle: 'Stil der Seitenleiste auswählen',
      sidebarInset: 'Eingerückt',
      sidebarFloating: 'Schwebend',
      sidebarStandard: 'Seitenleiste',
      sidebarDescription:
        'Zwischen eingerücktem, schwebendem oder Standard-Seitenleistenlayout wählen',
      mobileSidebarDescription: 'Zeigt die mobile Seitenleiste an.',
      layout: 'Layout',
      selectLayoutStyle: 'Layout-Stil auswählen',
      layoutDefault: 'Standard',
      layoutCompact: 'Kompakt',
      layoutFull: 'Volles Layout',
      layoutDescription:
        'Zwischen erweitertem Standard, kompakten Icons oder vollem Layout wählen',
      direction: 'Richtung',
      selectSiteDirection: 'Seitenrichtung auswählen',
      leftToRight: 'Links nach rechts',
      rightToLeft: 'Rechts nach links',
      directionDescription:
        'Zwischen Links-nach-rechts und Rechts-nach-links wählen',
    },
    countries: {
      DE: 'Deutschland',
      AT: 'Österreich',
      CH: 'Schweiz',
    },
    regions: {
      'DE-BW': 'Baden-Württemberg',
      'DE-BY': 'Bayern',
      'DE-BE': 'Berlin',
      'DE-BB': 'Brandenburg',
      'DE-HB': 'Bremen',
      'DE-HH': 'Hamburg',
      'DE-HE': 'Hessen',
      'DE-MV': 'Mecklenburg-Vorpommern',
      'DE-NI': 'Niedersachsen',
      'DE-NW': 'Nordrhein-Westfalen',
      'DE-RP': 'Rheinland-Pfalz',
      'DE-SL': 'Saarland',
      'DE-SN': 'Sachsen',
      'DE-ST': 'Sachsen-Anhalt',
      'DE-SH': 'Schleswig-Holstein',
      'DE-TH': 'Thüringen',
      'AT-1': 'Burgenland',
      'AT-2': 'Kärnten',
      'AT-3': 'Niederösterreich',
      'AT-4': 'Oberösterreich',
      'AT-5': 'Salzburg',
      'AT-6': 'Steiermark',
      'AT-7': 'Tirol',
      'AT-8': 'Vorarlberg',
      'AT-9': 'Wien',
      'CH-AG': 'Aargau',
      'CH-AI': 'Appenzell Innerrhoden',
      'CH-AR': 'Appenzell Ausserrhoden',
      'CH-BE': 'Bern',
      'CH-BL': 'Basel-Landschaft',
      'CH-BS': 'Basel-Stadt',
      'CH-FR': 'Freiburg',
      'CH-GE': 'Genf',
      'CH-GL': 'Glarus',
      'CH-GR': 'Graubünden',
      'CH-JU': 'Jura',
      'CH-LU': 'Luzern',
      'CH-NE': 'Neuenburg',
      'CH-NW': 'Nidwalden',
      'CH-OW': 'Obwalden',
      'CH-SG': 'St. Gallen',
      'CH-SH': 'Schaffhausen',
      'CH-SO': 'Solothurn',
      'CH-SZ': 'Schwyz',
      'CH-TG': 'Thurgau',
      'CH-TI': 'Tessin',
      'CH-UR': 'Uri',
      'CH-VD': 'Waadt',
      'CH-VS': 'Wallis',
      'CH-ZG': 'Zug',
      'CH-ZH': 'Zürich',
    },
    roles: {
      employee: 'Mitarbeiter',
      manager: 'Manager',
      hr: 'Personal',
      admin: 'Administrator',
      superadmin: 'Superadmin',
    },
    onboardingUi: {
      loadFailed:
        'Deine Einrichtung konnte nicht geladen werden. Bitte erneut versuchen.',
      stepFailed:
        'Dieser Schritt konnte nicht gespeichert werden. Bitte erneut versuchen.',
      title: 'FlowPro einrichten',
      subtitle:
        'Vier kurze Schritte. Alles außer den Firmendaten kannst du überspringen und später in den Einstellungen nachholen.',
      loading: 'Einrichtung wird geladen',
      progress: 'Fortschritt der Einrichtung',
      progressLabel: 'Fortschritt der Einrichtung',
      required: 'Erforderlich',
      optional: 'Optional',
      skipped: 'Übersprungen',
      skipForNow: 'Vorerst überspringen',
      saveAndContinue: 'Speichern und weiter',
      finishLater: 'Einrichtung später abschließen',
      finishedToast: 'Dein Arbeitsbereich ist bereit.',
      workspaceCreatedToast: 'Arbeitsbereich erstellt.',
      goToToday: 'Zu Heute',
      alreadyDoneTitle: 'Die Einrichtung ist bereits abgeschlossen',
      alreadyDoneDescription:
        'Dieser Arbeitsbereich hat die Ersteinrichtung abgeschlossen. Änderungen sind jederzeit in den Einstellungen möglich.',
      steps: {
        company: {
          title: 'Unternehmen und Arbeitszeit',
          description:
            'Legt den Feiertagskalender und die Wochenstunden fest, an denen jede Zeiterfassung gemessen wird.',
        },
        team: {
          title: 'Team einladen',
          description:
            'Eingeladene Personen erscheinen im Verzeichnis und können sich nach der Annahme sofort einstempeln.',
        },
        absences: {
          title: 'Urlaubsanspruch',
          description:
            'Der Jahresurlaub, mit dem neue Mitarbeitende starten. Einzelne Verträge können davon abweichen.',
        },
        firstClockIn: {
          title: 'Erstes Einstempeln',
          description:
            'Starte deinen eigenen Arbeitstag und sieh, wie FlowPro ihn erfasst.',
        },
      },
      company: {
        nameLabel: 'Firmenname',
        countryLabel: 'Land',
        regionLabel: 'Bundesland',
        regionNone: 'Kein Bundesland',
        regionHelp:
          'Feiertage unterscheiden sich je Bundesland und bestimmen den Kalender deines Teams.',
        timeZoneLabel: 'Zeitzone',
        weeklyHoursLabel: 'Wochenstunden',
        weeklyHoursHelp:
          'Standard-Vollzeitwoche. Teilzeitverträge werden später je Person festgelegt.',
      },
      team: {
        deliveryTitle: 'Einladungen werden in FlowPro angelegt',
        deliveryDescription:
          'Der E-Mail-Versand ist noch nicht konfiguriert. Eingeladene Personen erscheinen daher als offen im Verzeichnis. Sende ihnen den Anmeldelink vorerst selbst.',
        emailsLabel: 'E-Mail-Adressen',
        emailsPlaceholder: 'anna@example.com, ben@example.com',
        emailsHelp:
          'Trenne Adressen mit Komma, Leerzeichen oder Zeilenumbruch.',
        roleLabel: 'Rolle für diese Einladungen',
        invalidTitle: 'Einige Adressen wurden nicht erkannt',
        invalidDescription: 'Prüfe diese Einträge: {{addresses}}',
        failedTitle: 'Einige Einladungen konnten nicht erstellt werden',
        failedDescription:
          'Diese Adressen wurden nicht eingeladen: {{addresses}}. Du kannst es auf der Benutzerseite erneut versuchen.',
        sendInvites: '{{count}} Personen einladen',
        invitedToast: '{{count}} Personen eingeladen.',
      },
      absences: {
        annualLeaveLabel: 'Urlaubstage pro Jahr',
        annualLeaveHelp:
          'Bezogen auf eine Fünf-Tage-Woche. Das Gesetz verlangt mindestens 20.',
        includedTitle: 'Krankheit und Sonderurlaub sind bereits verfügbar',
        includedDescription:
          'Dein Team kann sie ab dem ersten Tag beantragen. Die Regeln lassen sich jederzeit in den Anwesenheitsrichtlinien anpassen.',
      },
      firstClockIn: {
        cardTitle: 'Zum ersten Mal einstempeln',
        cardDescription:
          'Das erzeugt eine echte Buchung für heute, damit du Zeitstrahl, Pausen und Summen in Aktion siehst.',
        action: 'Einstempeln und Einrichtung abschließen',
        skip: 'Ohne Einstempeln abschließen',
      },
      claim: {
        title: 'Benenne deinen Arbeitsbereich',
        description:
          'Das ist der letzte Schritt, bevor FlowPro dir gehört. Du kannst ihn später umbenennen.',
        signedInAs: 'Angemeldet als {{email}}',
        nameLabel: 'Name des Arbeitsbereichs',
        nameHelp: 'Meist der Firmenname. Dein Team sieht diesen Namen.',
        submit: 'Arbeitsbereich erstellen',
        errorTitle: 'Arbeitsbereich konnte nicht erstellt werden',
        signInRequiredTitle: 'Bitte zuerst anmelden',
        signInRequiredDescription:
          'Zum Erstellen eines Arbeitsbereichs ist eine aktive Anmeldung nötig.',
      },
      errors: {
        saveFailedTitle: 'Dieser Schritt konnte nicht gespeichert werden',
        companyNameRequired:
          'Gib einen Firmennamen mit mindestens 2 Zeichen ein.',
        workspaceNameRequired:
          'Gib einen Namen für den Arbeitsbereich mit mindestens 2 Zeichen ein.',
        weeklyHoursRequired: 'Gib die Wochenstunden als Zahl ein.',
        weeklyHoursRange:
          'Die Wochenstunden müssen zwischen {{min}} und {{max}} liegen. Das Arbeitszeitgesetz begrenzt die Woche auf durchschnittlich 48 Stunden.',
        leaveDaysRequired: 'Gib die Urlaubstage als Zahl ein.',
        leaveDaysRange:
          'Die Urlaubstage müssen zwischen {{min}} und {{max}} liegen.',
        alreadyClaimed:
          'Dieses Konto gehört bereits zu einem Arbeitsbereich. Bitte melde dich stattdessen an.',
      },
    },
    auth: {
      signUpFailed:
        'Die Registrierung konnte nicht gestartet werden. Bitte erneut versuchen.',
      flowProBrand: 'FlowPro',
      email: 'E-Mail',
      emailPlaceholder: 'name@example.com',
      password: 'Passwort',
      passwordPlaceholder: '********',
      confirmPassword: 'Passwort bestätigen',
      signIn: 'Anmelden',
      signUp: 'Registrieren',
      createAccount: 'Konto erstellen',
      forgotPassword: 'Passwort vergessen?',
      forgotPasswordTitle: 'Passwort vergessen',
      forgotPasswordDescription:
        'Gib deine registrierte E-Mail ein und wir senden dir einen Link zum Zurücksetzen des Passworts.',
      noAccountQuestion: 'Noch kein Konto?',
      signingIn: 'Anmeldung läuft...',
      sendingEmail: 'E-Mail wird gesendet...',
      emailSentTo: 'E-Mail an {{email}} gesendet',
      error: 'Fehler',
      continue: 'Weiter',
      verify: 'Bestätigen',
      oneTimePassword: 'Einmalpasswort',
      twoFactorAuthentication: 'Zwei-Faktor-Authentifizierung',
      otpDescription:
        'Bitte gib den Authentifizierungscode ein. Wir haben den Code an deine E-Mail gesendet.',
      didntReceiveCode: 'Nichts erhalten?',
      resendNewCode: 'Neuen Code senden',
      signInDescription: 'Melde dich mit deinem FlowPro-Konto an.',
      signUpDescription:
        'Erstelle dein Konto und gib danach dem Arbeitsbereich deines Teams einen Namen.',
      createAccountAgreementPrefix:
        'Durch das Erstellen eines Kontos stimmst du unseren',
      termsOfService: 'Nutzungsbedingungen',
      privacyPolicy: 'Datenschutzrichtlinien',
      and: 'und',
      superadminHint:
        'Superadmin: founder@flowpro.local. Seed-Mitarbeiterkonten verwenden ihre Seed-E-Mail und das konfigurierte Mitarbeiterpasswort.',
      noWorkspaceYet: 'Noch kein Arbeitsbereich?',
      createWorkspace: 'Jetzt erstellen',
      signUpTitle: 'Mit FlowPro starten',
      signUpAction: 'Arbeitsbereich erstellen',
      signUpHaveAccount: 'Du hast bereits einen Arbeitsbereich?',
      signUpValueCompliance:
        'Erfasst Arbeitszeit gesetzeskonform, inklusive Pausen und monatlicher Freigabe.',
      signUpValueLeave:
        'Urlaub, Krankmeldungen und Genehmigungen an einem Ort, mit stets korrekten Salden.',
      signUpValueTeam:
        'Lade dein Team ein und sieh vor jeder Genehmigung, wer verfügbar ist.',
      signUpUnavailableTitle: 'Die Selbstregistrierung ist hier nicht aktiv',
      signUpUnavailableDescription:
        'In dieser Installation können keine neuen Konten erstellt werden. Bitte deinen Administrator um eine Einladung.',
      returnToSignIn: 'Zur Anmeldung zurück',
      displayName: 'Dein Name',
      sendResetLink: 'Link zum Zurücksetzen senden',
      resetLinkSent:
        'Falls es für {{email}} ein Konto gibt, haben wir einen Link zum Zurücksetzen des Passworts gesendet. Sieh in deinem Posteingang nach.',
      resetPasswordTitle: 'Neues Passwort wählen',
      resetPasswordDescription:
        'Das neue Passwort ersetzt das alte und meldet dich auf allen Geräten ab.',
      newPassword: 'Neues Passwort',
      setNewPassword: 'Neues Passwort speichern',
      passwordResetDone:
        'Dein Passwort wurde geändert. Melde dich mit dem neuen an.',
      linkInvalidTitle: 'Dieser Link funktioniert nicht',
      linkMissing:
        'Öffne den Link aus der E-Mail erneut oder fordere einen neuen an.',
      requestNewLink: 'Neuen Link anfordern',
      verifyEmailTitle: 'E-Mail bestätigen',
      verifyingEmail: 'E-Mail-Adresse wird bestätigt...',
      emailVerified: 'Deine E-Mail-Adresse ist bestätigt.',
      confirmEmailChangeTitle: 'Neue E-Mail-Adresse bestätigen',
      confirmingEmailChange: 'Neue E-Mail-Adresse wird bestätigt...',
      emailChanged:
        'Dein Konto nutzt jetzt {{email}}. Melde dich ab sofort mit dieser Adresse an.',
      continueToApp: 'Weiter',
      passwordPolicy:
        'Mindestens {{count}} Zeichen. Ein paar zusammenhanglose Wörter eignen sich gut.',
      accountDetailsCaptured: 'Kontodaten für {{email}} erfasst',
      welcomeBack: 'Willkommen zurück, {{name}}!',
      invalidCredentials: 'E-Mail oder Passwort ist falsch.',
      simulationHint:
        'Die lokale Simulation akzeptiert aktive Seed-Nutzer und Nutzer, die in diesem Browser erstellt wurden.',
      errors: {
        emailRequired: 'Bitte E-Mail eingeben',
        passwordRequired: 'Bitte Passwort eingeben',
        passwordMinLength: 'Passwort muss mindestens 7 Zeichen lang sein',
        passwordTooShort: 'Verwende mindestens {{count}} Zeichen.',
        displayNameRequired: 'Bitte gib deinen Namen ein',
        confirmPasswordRequired: 'Bitte Passwort bestätigen',
        passwordsDontMatch: 'Passwörter stimmen nicht überein.',
        enterSixDigitCode: 'Bitte gib den 6-stelligen Code ein.',
      },
    },
    nav: {
      workday: 'Arbeitstag',
      administration: 'Administration',
      today: 'Heute',
      myTime: 'Meine Zeit',
      planning: 'Planung',
      requests: 'Anträge',
      teamAvailability: 'Team-Verfügbarkeit',
      reports: 'Berichte',
      users: 'Nutzer',
      privacyAudit: 'Datenschutz-Audit',
      settings: 'Einstellungen',
      attendancePolicies: 'Anwesenheitsrichtlinien',
      levelUser: 'Benutzer',
      levelManager: 'Manager',
      levelAdministrator: 'Administrator',
    },
    today: {
      title: 'Heute',
      subtitle: '{{date}} · Buchungen, Pausen und Anträge.',
      newRequest: 'Neuer Antrag',
      timesheet: 'Zeiterfassung',
    },
    periodPicker: {
      month: 'Monat',
      year: 'Jahr',
      previousMonth: 'Vorheriger Monat',
      nextMonth: 'Nächster Monat',
    },
    todayUi: {
      status: 'Status',
      preparingToday: 'Heute wird vorbereitet...',
      unknownDevice: 'Unbekanntes Gerät',
      mobileBrowser: 'Mobiler Browser',
      desktopBrowser: 'Desktop-Browser',
      nextLocation: 'Nächster Ort',
      workLocation: 'Arbeitsort',
      goodMorning: 'Guten Morgen, {{name}}',
      notWorking: 'Nicht am Arbeiten',
      chooseLocationClockIn:
        'Wähle deinen Arbeitsort und stemple ein, sobald du startest.',
      ready: 'Bereit',
      youAreWorking: 'Du arbeitest',
      workingStarted: 'Arbeitet · Start {{time}}',
      currentLocation: 'Aktueller Ort: {{location}}.',
      workingBadge: 'Arbeitet',
      breakInProgress: 'Pause läuft',
      onBreak: 'In Pause · {{duration}}',
      resumeAfterBreak: 'Setze die Arbeit fort, wenn deine Pause beendet ist.',
      onBreakBadge: 'In Pause',
      finishedForToday: 'Für heute beendet',
      finishedForTodayDescription:
        'Stemple für eine zweite flexible Sitzung erneut ein oder verwalte eine Korrektur.',
      finished: 'Beendet',
      clockInAgain: 'Erneut einstempeln',
      clockIn: 'Einstempeln',
      clockOut: 'Ausstempeln',
      startBreak: 'Pause starten',
      resumeWork: 'Arbeit fortsetzen',
      correctTodaysTime: 'Heutige Zeit korrigieren',
      requestLeave: 'Abwesenheit beantragen',
      correctMissingTime: 'Fehlende Zeit korrigieren',
      bookingSource: 'Buchungsquelle',
      manualCorrection: 'Manuelle Korrektur',
      locationCapturedWithin: 'Standort in {{meters}}m erfasst',
      locationOptional: 'Standort optional',
      updateLocation: 'Standort aktualisieren',
      locating: 'Standort wird ermittelt...',
      captureLocation: 'Standort erfassen',
      manageBookings: 'Buchungen verwalten',
      openRequests: 'Offene Anträge',
      openRequestsDescription:
        'Anträge, die noch eine Entscheidung oder Nachverfolgung benötigen.',
      viewAll: 'Alle anzeigen',
      noOpenRequests: 'Keine offenen Anträge',
      noOpenRequestsDescription:
        'Erstelle einen Antrag, wenn du Abwesenheit, Homeoffice oder eine Buchungskorrektur brauchst.',
      createRequest: 'Antrag erstellen',
      manageTodaysBookings: 'Heutige Buchungen verwalten',
      manageTodaysBookingsDescription:
        'Korrigiere oder storniere eine Tagesbuchung. Der ursprüngliche Nachweis bleibt erhalten und jede Änderung wird auf dem Server auditiert.',
      noBookingsToday: 'Heute keine Buchungen',
      noBookingsTodayDescription:
        'Stemple in Heute ein, um die Zeitleiste zu starten. Tageskorrekturen erscheinen hier nach dem ersten Ereignis.',
      bookingSyncPendingNotice:
        'Diese Buchung wird noch mit dem Server synchronisiert. Sie kann korrigiert oder storniert werden, sobald die Synchronisierung abgeschlossen ist.',
      noDeviceRecorded: 'Kein Gerät erfasst',
      time: 'Zeit',
      in: 'Ein',
      out: 'Aus',
      workedToday: 'Heute gearbeitet',
      breakToday: 'Heute Pause',
      started: 'Begonnen',
      breakStarted: 'Pause gestartet',
      source: 'Quelle',
      browser: 'Browser',
      manualEdit: 'Manuelle Bearbeitung',
      terminal: 'Terminal',
      system: 'System',
      location: 'Standort',
      deleteBookingQuestion: 'Buchung löschen?',
      deleteBookingDescription:
        'Dies storniert die Buchung auf dem Server. Der ursprüngliche Datensatz bleibt im Audit-Verlauf erhalten.',
      correctionReason: 'Grund der Änderung',
      correctionReasonPlaceholder:
        'Beschreibe, warum diese Buchung korrigiert oder storniert werden muss.',
      keepBooking: 'Buchung behalten',
      deleteBooking: 'Buchung löschen',
      saveEvent: 'Ereignis speichern',
      unableToBookTime: 'Zeit konnte nicht gebucht werden.',
      bookingSaved: 'Zeitbuchung gespeichert.',
      bookingQueuedOffline:
        'Zeitbuchung lokal gespeichert und zur Synchronisierung vorgemerkt, sobald die API verfügbar ist.',
      clockEventUpdated: 'Zeitereignis aktualisiert.',
      unableToUpdateEvent: 'Ereignis konnte nicht aktualisiert werden.',
      bookingRemovedFromToday: 'Buchung wurde aus heute entfernt.',
      unableToRemoveBooking: 'Buchung konnte nicht entfernt werden.',
      yesterdayClosed: 'Gestern wurde geschlossen.',
      unableToCloseYesterday: 'Gestern konnte nicht geschlossen werden.',
      mutationErrors: {
        validation: 'Prüfe Buchungszeit und Begründung und versuche es erneut.',
        conflict:
          'Diese Änderung würde die Buchungsreihenfolge beschädigen. Erstelle stattdessen einen Korrekturantrag.',
        unavailable:
          'Die FlowPro-API ist momentan nicht erreichbar. Versuche es gleich noch einmal.',
      },
      inProgress: 'Läuft',
      todayTotals: 'Heutige Summen',
      calculatedFromLocalClockEvents:
        'Aus server-synchronisierten Zeitereignissen berechnet.',
      worked: 'Geleistet',
      break: 'Pause',
      flex: 'Flex',
      bookings: 'Buchungen',
      monthlyBalancesHint:
        'Monatssalden und Urlaubsanspruch werden in Zeiterfassung und Berichte verwaltet.',
      dayTimeline: 'Tageszeitleiste',
      dayTimelineDescription: 'Heute auf einen Blick.',
      myTimesheetsDescription:
        'Heute und der vorherige Arbeitstag als kompakte Anwesenheitsgrafik.',
      timelineEmpty:
        'Noch keine Buchung. Stemple ein, um die Zeitleiste zu starten.',
      timelineClockedInOffice: 'Eingestempelt · Büro',
      timelineClockedInHomeOffice: 'Eingestempelt · Homeoffice',
      timelineBreakStarted: 'Pause gestartet',
      timelineResumedWork: 'Arbeit fortgesetzt',
      timelineClockedOut: 'Ausgestempelt',
      workStateAnnouncement: 'Arbeitsstatus: {{state}}',
      commandErrors: {
        'clock-in.invalid-state':
          'Du kannst nur einstempeln, bevor die Arbeit begonnen hat.',
        'start-break.invalid-state':
          'Du kannst nur während der Arbeit eine Pause starten.',
        'resume-work.invalid-state':
          'Du kannst die Arbeit nur während einer Pause fortsetzen.',
        'clock-out.invalid-state':
          'Du kannst nur ausstempeln, während du arbeitest.',
      },
    },
    todayAttentionUi: {
      title: 'Achtung',
      description: 'Kleine Punkte, die geprüft werden sollten.',
      yesterdayStillOpen: 'Gestern ist noch offen',
      yesterdayStillOpenDescription:
        'FlowPro hat einen unvollständigen Arbeitstag erkannt. Schließe ihn mit der Uhrzeit, zu der du tatsächlich aufgehört hast zu arbeiten.',
      closeDay: 'Tag schließen',
      breakRuleWarning: 'Warnung zur Pausenregel',
      needBreakTime: 'Du brauchst noch {{duration}} Pausenzeit. ',
      aboveTenHourGuideline:
        'Du liegst {{duration}} über der 10-Stunden-Arbeitsrichtlinie.',
      noUrgentIssues: 'Keine dringenden Anwesenheitsprobleme erkannt.',
      openPlanning: 'Planung öffnen',
    },
    requestsPage: {
      title: 'Anträge',
      subtitle:
        'Abwesenheits- und Korrekturanträge erstellen, verfolgen und prüfen.',
      syncing: 'Synchronisiere {{count}}',
      tabCreate: 'Erstellen',
      tabMine: 'Meine',
      tabApprovals: 'Freigaben',
      tabHistory: 'Verlauf',
      restricted:
        'Die Freigabewarteschlange ist nur für Manager, HR und Administratoren verfügbar.',
      approvingFor: 'Freigabe für: {{teams}}',
    },
    timesheetPage: {
      title: 'Zeiterfassung',
      payrollCsv: 'Lohnabrechnungs-CSV',
      exportPdf: 'PDF exportieren',
      exportScope: '{{employee}} · {{period}}',
      payrollRestricted:
        'Nur HR, Administratoren und Superadmins dürfen Payroll exportieren.',
      payrollExported: 'Lohnabrechnungs-CSV exportiert.',
      exportFailed: 'Export-Workflow konnte nicht abgeschlossen werden.',
      printBlocked:
        'Druckbares HTML wurde exportiert, weil das Druckfenster blockiert war.',
      pdfPrepared: 'PDF-Druckansicht vorbereitet.',
      signRestricted:
        'Nur autorisierte Manager, HR oder Admins dürfen diesen Monat signieren.',
      resolveExceptions:
        'Bitte alle Zeiterfassungs-Ausnahmen vor dem Signieren beheben.',
      signFailed: 'Dieser Monat konnte nicht signiert werden.',
      signedLocked: 'Zeiterfassung wurde signiert und gesperrt.',
    },
    requests: {
      status: {
        submitted: 'Eingereicht',
        approved: 'Genehmigt',
        rejected: 'Abgelehnt',
        cancelled: 'Storniert',
      },
      kind: {
        absence: 'Abwesenheit',
        bookingCorrection: 'Buchungskorrektur',
        officialAbsence: 'Offizielle Abwesenheit',
      },
    },
    requestsUi: {
      historyTitle: 'Verlauf',
      historySubtitle: 'Abgeschlossene Anträge mit finalen Entscheidungen.',
      searchRequests: 'Anträge suchen...',
      clearSearch: 'Suche leeren',
      approvalTitle: 'Freigabewarteschlange',
      approvalSubtitle: 'Eingereichte Anträge filtern, prüfen und entscheiden.',
      policyBlock: 'Richtlinienblock',
      policyBlocks: 'Richtlinienblöcke',
      warning: 'Warnung',
      warnings: 'Warnungen',
      employee: 'Mitarbeiter',
      allEmployees: 'Alle Mitarbeiter',
      requestType: 'Antragstyp',
      allRequestTypes: 'Alle Antragstypen',
      selectedForBatch: '{{count}} für Sammelprüfung ausgewählt',
      rejectSelected: 'Auswahl ablehnen',
      approveSelected: 'Auswahl genehmigen',
      date: 'Datum',
      request: 'Antrag',
      person: 'Person',
      type: 'Typ',
      details: 'Details',
      status: 'Status',
      actions: 'Aktionen',
      loadingRequests: 'Anträge werden geladen',
      loadingRequestsDescription:
        'Lokale Anträge, Freigaben, Anhänge und Sync-Metadaten werden geprüft.',
      noRequestsTitle: 'Keine Anträge in dieser Ansicht',
      noRequestsDescription:
        'Anderen Filter nutzen oder im Tab Neuer Antrag einen Abwesenheits-, Buchungskorrektur- oder offiziellen Antrag erstellen.',
      review: 'Prüfen',
      hideDetails: 'Details ausblenden',
      showDetails: 'Details anzeigen',
      ownCorrectionsOnly: 'Nur eigene Korrekturen',
      correctTime: 'Zeit korrigieren',
      dayLength: 'Tageslänge',
      weeklyOccurrences: 'Wöchentlich, {{count}} Mal',
      series: 'Serie',
      privateDetailsMasked: 'Private Details maskiert',
      employeeReason: 'Mitarbeiterbegründung',
      reasonHiddenByPolicy:
        'Durch Datenschutzrichtlinie verborgen. HR/Admin und der Mitarbeiter können den Grund sehen.',
      selectRequestRow: 'Antragszeile auswählen',
      cancelRequest: 'Antrag stornieren',
      reviewRequest: 'Antrag prüfen',
      hiddenByPrivacyPolicy:
        'Dieser Antrag ist durch die aktuelle Datenschutzrichtlinie verborgen.',
      protected: 'Geschützt',
      gdprPrivacyByDefault: 'DSGVO Datenschutz als Standard',
      detailsHidden: 'Details verborgen',
      onlyHrAdminEmployeeCanView:
        'Nur HR/Admin und der Mitarbeiter können sensible Antragsdetails sehen.',
      checkOperationalImpact:
        'Operative Auswirkungen vor Genehmigung oder Ablehnung prüfen.',
      approvalRoute: 'Freigabeweg',
      autoApprovedByPolicy:
        'Durch Anwesenheitsrichtlinie automatisch genehmigt.',
      unassignedApprover: 'Nicht zugewiesen',
      waitingForApprover: 'Wartet auf {{names}}',
      approvalStepStatus: {
        pending: 'Ausstehend',
        approved: 'Genehmigt',
        rejected: 'Abgelehnt',
      },
      rejecting: 'Wird abgelehnt...',
      reject: 'Ablehnen',
      approving: 'Wird genehmigt...',
      approveAdjusted: 'Angepasst genehmigen',
      approve: 'Genehmigen',
      managerComment: 'Manager-Kommentar',
      optionalDecisionNote:
        'Optionale Entscheidungsnotiz für Mitarbeiter und Audit-Trail...',
      decisionActionsDisabled:
        'Entscheidungsaktionen sind deaktiviert, weil dieser Antrag bereits {{status}} ist.',
      approveAdjustedHint:
        'Angepasst genehmigen wird aktiv, sobald mindestens ein Datum oder eine Uhrzeit geändert wurde.',
      policyBlocksMustBeResolved:
        'Richtlinienblöcke müssen vor Genehmigung angepasster Details behoben werden.',
      submitting: 'Wird gesendet...',
      dates: 'Daten',
      duration: 'Dauer',
      submitted: 'Eingereicht',
      daySingular: 'Tag',
      dayPlural: 'Tage',
      selectAllVisibleRequests: 'Alle sichtbaren Anträge auswählen',
      draftSummary: 'Entwurfszusammenfassung',
      attachments: 'Anhänge',
      attachmentAdd: 'Dateien hinzufügen',
      attachmentDescription:
        'Optionale Nachweise. Dateien werden sicher hochgeladen, bevor der Antrag eingereicht wird.',
      uploadingAttachments: 'Anhänge werden hochgeladen...',
      attachmentUploadFailed: 'Anhang konnte nicht hochgeladen werden.',
      attachmentDeleteFailed: 'Anhang konnte nicht gelöscht werden.',
      delete: 'Löschen',
      deleting: 'Wird gelöscht...',
      submitRequest: 'Antrag einreichen',
      submittingRequest: 'Wird eingereicht…',
      clearDraft: 'Entwurf leeren',
      completeRequiredFields:
        'Pflichtfelder ausfüllen, um den Antrag einzureichen.',
      policyCheck: 'Abdeckung und Richtlinienprüfung',
      policyBlockLabel: 'Richtlinienblock',
      managerWarning: 'Manager-Warnung',
      conflictWarning: 'Konfliktwarnung',
      auditHidden: 'Audit ausgeblendet',
      auditHiddenDescription:
        'Vollständige Audit-Verläufe sind auf HR/Admin und den Mitarbeiter beschränkt.',
      auditTimeline: 'Audit-Verlauf',
      noAuditEvents: 'Noch keine Audit-Ereignisse',
      noAuditEventsDescription:
        'Entscheidungs- und Sichtbarkeitsereignisse erscheinen hier, sobald dieser Antrag geprüft wird.',
      approveWithChanges: 'Mit Änderungen genehmigen',
      approveWithChangesDescription:
        'Ersetze den eingereichten Antrag durch angepasste Daten oder Zeiten und genehmige die Ersetzung.',
      editing: 'Wird bearbeitet',
      edit: 'Bearbeiten',
      from: 'Von',
      to: 'Bis',
      adjustedDayLength: 'Angepasste Tageslänge',
      end: 'Ende',
      clockIn: 'Einstempeln',
      clockOut: 'Ausstempeln',
      adjustmentRequired:
        'Mindestens ein Datum, eine Zeit oder die Tageslänge ändern, bevor angepasste Details genehmigt werden.',
      planAbsence: 'Abwesenheit planen',
      planAbsenceDescription:
        'Urlaub, Krankheit, Homeoffice oder Sonderurlaub.',
      fixBooking: 'Buchung korrigieren',
      fixBookingDescription:
        'Vergessenes Ein-/Ausstempeln, Pause oder Buchungspaar korrigieren.',
      officialAbsence: 'Offizielle Abwesenheit',
      officialAbsenceDescription:
        'Offizielle Abwesenheitseinträge für einen Arbeitstag korrigieren.',
      oneFocusedForm: 'Ein fokussiertes Formular für den gewählten Antragstyp.',
      preselectedRequestKind:
        '{{type}} wurde aus der vorherigen Aktion vorausgewählt. Du kannst weiterhin einen anderen Antragstyp wählen.',
      remark: 'Bemerkung',
      optionalNote: 'Optionale Notiz für den Prüfer...',
      absenceType: 'Abwesenheitstyp',
      repeat: 'Wiederholen',
      doesNotRepeat: 'Keine Wiederholung',
      weekly: 'Wöchentlich',
      occurrences: 'Vorkommen',
      correctionType: 'Korrekturtyp',
      officialAbsenceType: 'Typ der offiziellen Abwesenheit',
      beginning: 'Beginn',
      bookingTypePair: 'Buchungspaar hinzufügen',
      bookingTypeClockIn: 'Einstempeln hinzufügen',
      bookingTypeClockOut: 'Ausstempeln hinzufügen',
      bookingTypeBreak: 'Pause hinzufügen',
      bookingTypeSpecial: 'Sonderbuchung',
      officialTypeFullDay: 'Ganzer Tag',
      officialTypeBeforeStart: 'Vor Arbeitsbeginn',
      officialTypeAfterEnd: 'Nach Arbeitsende',
      partialFullDay: 'Ganzer Tag',
      partialMorning: 'Vormittag',
      partialAfternoon: 'Nachmittag',
      partialCustomHours: 'Individuelle Stunden',
      filesCount: '{{count}} Datei(en)',
      requestSubmitted: 'Antrag eingereicht.',
      recurringRequestsSubmitted:
        '{{count}} wiederkehrende Anträge eingereicht.',
      unableToSubmitRequest: 'Antrag konnte nicht eingereicht werden.',
      requestApproved: 'Antrag genehmigt.',
      requestRejected: 'Antrag abgelehnt.',
      unableToDecideRequest: 'Antrag konnte nicht entschieden werden.',
      batchRequestsApproved: '{{count}} Anträge genehmigt.',
      batchRequestsRejected: '{{count}} Anträge abgelehnt.',
      unableToDecideRequests: 'Anträge konnten nicht entschieden werden.',
      adjustedRequestApproved: 'Angepasster Antrag genehmigt.',
      unableToApproveAdjustedRequest:
        'Angepasster Antrag konnte nicht genehmigt werden.',
      requestCancelled: 'Antrag storniert.',
      unableToCancelRequest: 'Antrag konnte nicht storniert werden.',
      rejectedInBatchReview: 'In der Sammelprüfung abgelehnt.',
      approvedInBatchReview: 'In der Sammelprüfung genehmigt.',
      policyInvalidDateRange: 'Das Enddatum muss nach dem Startdatum liegen.',
      policyInvalidPartialDay:
        'Individuelle Teil-Tage benötigen eine gültige Start- und Endzeit.',
      policyOwnRequestConflict:
        'In diesem Zeitraum gibt es bereits einen eingereichten oder genehmigten Antrag.',
      policyVacationBalance:
        'Dieser Antrag benötigt {{requested}} Urlaubstage, aber nur {{available}} sind verfügbar.',
      policyHomeOfficeLimit:
        'Homeoffice würde in {{month}} {{days}} Tage erreichen; das Richtlinienziel ist {{target}}.',
      policyTeamCoverage:
        'Mehrere Teamkollegen sind in diesem Zeitraum bereits nicht verfügbar. Die Manager-Prüfung sollte die Abdeckung kontrollieren.',
      aiReadyWorkflow: 'KI-bereiter Ablauf',
      aiReadyWorkflowDescription:
        'Zukünftige KI kann diesen Entwurf aus natürlicher Sprache ausfüllen; die Prüfung vor dem Absenden bleibt erhalten.',
      validation: {
        endDateBeforeStart: 'Das Enddatum muss nach dem Startdatum liegen.',
        chooseStatusType: 'Wähle einen Abwesenheits- oder Status-Typ.',
        addBookingTime: 'Füge mindestens eine Buchungszeit hinzu.',
        validPartialDayRange:
          'Füge einen gültigen benutzerdefinierten Teil-Tages-Zeitraum hinzu.',
        recurrenceRange:
          'Wiederkehrende Anträge können 1 bis 12 Vorkommen enthalten.',
        attachmentSize: 'Anhänge dürfen maximal 10 MB groß sein.',
        onlySubmittedCanBeDecided:
          'Nur eingereichte Anträge können entschieden werden.',
        onlySubmittedCanBeCancelled:
          'Nur eingereichte Anträge können storniert werden.',
        onlySubmittedCanBeAdjusted:
          'Nur eingereichte Anträge können angepasst werden.',
      },
      policyWarnings: {
        ownRequestConflict:
          'In diesem Zeitraum gibt es bereits einen eingereichten oder genehmigten Antrag.',
        vacationBalance:
          'Dieser Antrag benötigt {{requestedVacationDays}} Urlaubstage, aber nur {{vacationAvailableDays}} sind verfügbar.',
        homeOfficeLimit:
          'Homeoffice würde in {{monthKey}} {{currentDays}} Tage erreichen; das Richtlinienziel ist {{maxDays}}.',
        teamCoverage:
          'Mehrere Teamkollegen sind in diesem Zeitraum bereits nicht verfügbar. Die Manager-Prüfung sollte die Abdeckung kontrollieren.',
        recurrencePattern:
          'Wiederkehrende Anträge werden pro Vorkommen geprüft; jede Woche kann weiterhin einzeln angenommen oder abgelehnt werden.',
        vacationEntitlement:
          'Für den angefragten Zeitraum ist kein Urlaubssaldo verfügbar.',
      },
      seedReasons: {
        focusDay: 'Fokus-Tag für Implementierungsarbeit.',
        summerVacation: 'Sommerurlaub.',
        privateAppointment: 'Privater Termin.',
        familyTravel: 'Familienreise.',
        forgotTerminalClockIn: 'Das Einstempeln am Terminal wurde vergessen.',
      },
      seedLabels: {
        vacation: 'Urlaub',
        addBookingPair: 'Buchungspaar hinzufügen',
      },
      auditSummaries: {
        submitted: '{{employeeName}} hat {{subtype}} eingereicht.',
        decided: '{{actorName}} hat {{subtype}} {{status}}.',
        cancelled: '{{actorName}} hat {{subtype}} storniert.',
      },
    },
    timesheetUi: {
      day: 'Tag',
      worked: 'Geleistet',
      target: 'Soll',
      flex: 'Flex',
      break: 'Pause',
      breaks: 'Pausen',
      periodSummary: 'Periodenzusammenfassung',
      metric: 'Metrik',
      start: 'Start',
      sum: 'Summe',
      result: 'Ergebnis',
      current: 'Aktuell',
      workedHours: 'Geleistete Stunden',
      paidHours: 'Bezahlte Stunden',
      targetHours: 'Sollstunden',
      flexBalance: 'Flexsaldo',
      selectedEmployee: 'Ausgewählter Mitarbeiter',
      periodFilterDescription:
        'Wähle aus, welche Monate für Prüfung und Export verfügbar sein sollen.',
      payrollExportRoleNote:
        'Lohnabrechnungs-Export ist für HR, Administratoren und Superadmins verfügbar.',
      decimalHours: 'Dezimalstunden',
      scheduledMonth: 'Geplanter Monat',
      scheduledToDate: 'Geplant bis heute',
      currentPeriodBalance: 'Aktueller Periodensaldo',
      recordedBreakTime: 'Erfasste Pausenzeit',
      breakBalance: 'Pausensaldo',
      comment: 'Kommentar',
      correctedBy: 'Korrigiert von {{name}}',
      dayDetails: 'Tagesdetails',
      dayDetailsDescription:
        'Buchungen, Pausensaldo und Korrekturkontext für den ausgewählten Tag.',
      timeline: 'Zeitleiste',
      emptyDescription:
        'Zeitraum oder Filter ändern, um einen anderen Teil der Zeiterfassung zu prüfen.',
      dayActions: 'Tagesaktionen',
      correctMissingOrInaccurateBooking:
        'Bitte korrigieren Sie die fehlende oder fehlerhafte Buchung für diesen Tag.',
      addBookingPair: 'Buchungspaar hinzufügen',
      addBooking: 'Buchung hinzufügen',
      correctionRequestSubmitted: 'Korrekturantrag eingereicht.',
      unableToSubmitCorrectionRequest:
        'Korrekturantrag konnte nicht eingereicht werden.',
      submitBookingCorrectionDescription:
        'Buchungskorrektur zur Manager-Prüfung einreichen.',
      needsAttention: 'Benötigt Aufmerksamkeit',
      correction: 'Korrektur',
      editDayBookings: 'Tagesbuchungen bearbeiten',
      editDayBookingsDescription:
        'Einstempelzeiten, Ausstempelzeiten, Pausen und Arbeitsorte vorschlagen.',
      approvalRoute: 'Freigabeweg',
      teamLead: 'Teamleitung',
      autoApprovedByPolicy: 'Durch Richtlinie automatisch freigegeben',
      autoApprovedAuditHint:
        'Diese Änderung wird automatisch angewendet und im Audit-Verlauf gespeichert.',
      hrReview: 'HR-Prüfung',
      eventsCount: '{{count}} Ereignisse',
      event: 'Ereignis',
      selectEventType: 'Ausgewählter Ereignistyp: {{type}}',
      addEventType: 'Ereignis {{type}} hinzufügen',
      time: 'Zeit',
      workLocation: 'Arbeitsort',
      removeEvent: 'Ereignis entfernen',
      submitChanges: 'Änderungen einreichen',
      timesheetChangeAutoApproved:
        'Zeiterfassungsänderung automatisch freigegeben.',
      submitCorrection: 'Korrektur einreichen',
      currentBookings: 'Aktuelle Buchungen',
      currentBookingsDescription:
        'Das zeigt die Zeiterfassung derzeit für den ausgewählten Tag.',
      correctClockIn: 'Einstempeln korrigieren',
      correctClockOut: 'Ausstempeln korrigieren',
      correctionReasonExample:
        'Beispiel: Ich habe vergessen, mich nach Verlassen des Büros auszustempeln.',
      correctionWorkflowHint:
        'Die Korrektur wird lokal gespeichert, zur Synchronisierung vorgemerkt und erscheint unter Anträgen zur Manager-Freigabe. Die ursprünglichen Zeitereignisse bleiben unverändert, bis ein realer Freigabeworkflow die Korrektur anwendet.',
      noRowsInThisView: 'Keine Zeiterfassungszeilen in dieser Ansicht',
      openActionsForDay: 'Aktionen für {{day}} öffnen',
      previousPeriod: 'Vorherige Periode',
      nextPeriod: 'Nächste Periode',
      signedByOn: 'Signiert von {{name}} am {{date}}',
      signingLocksActions:
        'Die Signierung sperrt Korrekturaktionen für diesen Monat und erstellt einen synchronisierbaren Freigabedatensatz.',
      onlyAuthorizedCanSign:
        'Nur autorisierte Manager, HR und Administratoren können die Zeiterfassung eines anderen Mitarbeiters signieren.',
      optionalSignOffNote: 'Optionale Signierungsnotiz',
      signMonth: 'Monat signieren',
      resolveExceptionsBeforeSignOff:
        'Ausnahmezeilen vor der Signierung auflösen.',
      reviewExceptionsBeforeSignOff:
        '{{count}} Ausnahmezeilen vor der Signierung prüfen',
      noBookings: 'Keine Buchungen',
      open: 'offen',
      overtimeShort: 'ÜS',
      weekend: 'Wochenende',
      workday: 'Arbeitstag',
      today: 'Heute',
      yesterday: 'Gestern',
      myTimesheets: 'Meine Zeiterfassung',
      timelineLedgerDescription:
        'Tägliche Einstempelzeiten, Pausen, Überstunden und Flex in chronologischer Reihenfolge.',
      legendWorkingTime: 'Arbeitszeit',
      legendBreak: 'Pause',
      legendOvertime: 'Überstunden',
      legendLate: 'Verspätung',
      badges: {
        corrected: 'Korrigiert',
        holiday: 'Feiertag',
        homeOffice: 'Homeoffice',
        longBreak: 'Lange Pause',
        missing: 'Fehlend',
        negativeFlex: 'Negativer Flexsaldo',
        planned: 'Geplant',
        plusFlex: 'Positiver Flexsaldo',
        weekend: 'Wochenende',
      },
      exportStatus: {
        corrected: 'Korrigiert',
        publicHoliday: 'Feiertag',
        weekend: 'Wochenende',
        workday: 'Arbeitstag',
      },
      unknownEmployeeLabel: 'Unbekannter Mitarbeiter',
      tabLedger: 'Zeitkonto',
      tabSignOff: 'Signierung',
      tabSummary: 'Zusammenfassung',
      tabMonth: 'Monat',
      tabWeek: 'Woche',
      tabExceptions: 'Ausnahmen',
      exceptionsOnly: 'Nur Ausnahmen',
      rowsShown: 'Angezeigte Tage: {{count}}',
      noExceptionsInPeriod: 'Keine Ausnahmen in dieser Periode.',
      vacationYear: 'Urlaub {{year}}',
      vacationAnnualLeave: 'Jahresurlaub',
      vacationDisability: 'Aufgrund Schwerbehinderung',
      vacationExtraHoliday1: 'Zusatzurlaub 1',
      vacationExtraHoliday2: 'Zusatzurlaub 2',
      vacationFromPreviousYear: 'Aus dem Vorjahr',
      vacationExpired: 'Verfallen',
      vacationTaken: 'Genommen',
      vacationRemaining: 'Verbleibender Urlaub',
      vacationPlanned: 'Geplant',
      vacationAvailable: 'Verfügbar',
    },
    errorsUi: {
      goBack: 'Zurück',
      backToHome: 'Zur Startseite',
      unauthorizedTitle: 'Unbefugter Zugriff',
      unauthorizedDescription:
        'Bitte melde dich mit den passenden Zugangsdaten an, um auf diese Ressource zuzugreifen.',
      forbiddenTitle: 'Zugriff verboten',
      forbiddenDescription:
        'Du hast nicht die erforderliche Berechtigung, um diese Ressource anzusehen.',
      notFoundTitle: 'Seite nicht gefunden',
      notFoundDescription:
        'Diese FlowPro-Seite existiert nicht mehr oder deine aktuelle Rolle darf sie nicht öffnen.',
      generalTitle: 'FlowPro konnte diese Seite nicht laden',
      generalDescription:
        'Die App ist auf einen unerwarteten Zustand gestoßen. Gehe zurück oder zur Startseite und versuche die Aktion erneut.',
      somethingWentWrong: 'Etwas ist schiefgelaufen!',
      contentNotFound: 'Inhalt nicht gefunden.',
      contentNotModified: 'Inhalt wurde nicht geändert.',
      sessionExpired:
        'Deine Sitzung ist abgelaufen. Melde dich erneut an, um fortzufahren.',
      forbidden: 'Du hast keine Berechtigung für diese Aktion.',
      routeErrorTitle: 'Diese Seite konnte nicht angezeigt werden',
      routeErrorDescription:
        'Beim Aufbau dieser Seite ist etwas schiefgelaufen. Der Rest von FlowPro ist weiterhin verfügbar.',
      routeErrorDataDescription:
        'Diese Seite konnte ihre Daten nicht laden. Prüfe deine Verbindung und versuche es erneut.',
      tryAgain: 'Erneut versuchen',
      internalServerError: 'Interner Serverfehler.',
      maintenanceTitle: 'Website wird gewartet!',
      maintenanceDescription:
        'Die Seite ist momentan nicht verfügbar. Wir sind in Kürze wieder online.',
    },
    reportsUi: {
      worked: 'Geleistet',
      clockedProductiveHours: 'Erfasste Produktivstunden',
      paid: 'Bezahlt',
      payrollRelevantPaidHours: 'Payroll-relevante bezahlte Stunden',
      paidMinusTargetHours: 'Bezahlt minus Sollstunden',
      locked: 'Gesperrt',
      openMonthlyPeriods: '{{count}} offene Monatsperioden',
      notExported: 'Nicht exportiert',
      breakIssues: 'Pausenprobleme',
      legalBreakComplianceWarnings:
        'Warnungen zur gesetzlichen Pausenkonformität',
      payrollPackage: 'Payroll-Paket',
      exportVisibleEmployeeSet:
        'Exportiere den aktuell sichtbaren Mitarbeiterkreis für {{periodMonth}}.',
      excel: 'Excel',
      pdf: 'PDF',
      signVisiblePeriods: 'Sichtbare Perioden signieren',
      payroll: 'Payroll',
      breakCompliance: 'Pausenkonformität',
      absenceBalances: 'Abwesenheitssalden',
      teams: 'Teams',
      monthlyApprovals: 'Monatliche Freigaben',
      monthlyApprovalsDescription:
        'Signierte Perioden sind für Korrekturen gesperrt und bereit für den Payroll-Export.',
      team: 'Team',
      exports: 'Exporte',
      loadingReports: 'Berichte werden geladen...',
      signedAndLocked: 'Signiert und gesperrt',
      openPeriod: 'Offene Periode',
      yes: 'Ja',
      no: 'Nein',
      legalBreakCompliance: 'Gesetzliche Pausenkonformität',
      legalBreakComplianceDescription:
        'Tage mit mehr als sechs oder neun Arbeitsstunden müssen die erforderliche Pausenzeit erfüllen.',
      exportEvidence: 'Nachweise exportieren',
      required: 'Erforderlich',
      ok: 'OK',
      missingBreak: 'Pause fehlt',
      noLegalBreakEntries:
        'Keine gesetzlichen Pauseneinträge in dieser Periode.',
      absenceBalanceReport: 'Abwesenheitssaldo-Bericht',
      absenceBalanceReportDescription:
        'Urlaub, Krankheit und Homeoffice-Nutzung aus lokalen Anträgen.',
      exportCsv: 'CSV exportieren',
      annual: 'Jährlich',
      approved: 'Genehmigt',
      planned: 'Geplant',
      remaining: 'Verbleibend',
      sickness: 'Krankheit',
      noAbsenceBalances: 'Keine Abwesenheitssalden in dieser Periode.',
      managerTeamReport: 'Manager-Teambericht',
      managerTeamReportDescription:
        'Teambezogene Payroll-Bereitschaft, Flex, Kapazität und Konformität.',
      headcount: 'Mitarbeiterzahl',
      signed: 'Signiert',
      open: 'Offen',
      absenceDays: 'Abwesenheitstage',
      noTeamReportRows: 'Keine Teambericht-Zeilen in dieser Periode.',
      reportExportGenerated: 'Berichtsexport erstellt.',
      allVisiblePeriodsAlreadySigned:
        'Alle sichtbaren Perioden sind bereits signiert.',
      signedFromReportsPayroll: 'Aus Berichte / Payroll signiert.',
      visibleMonthlyPeriodsSignedLocked:
        'Sichtbare Monatsperioden signiert und gesperrt.',
      monthlySignOff: 'Monatliche Signierung',
      compliance: 'Konformität',
      reportsPayroll: 'Berichte & Payroll',
      reportsPayrollDescription:
        'Exportiere payroll-fähige Zeitdatensätze, Pausenkonformität, Abwesenheitssalden und Teamzusammenfassungen.',
      period: 'Periode',
      accessRestricted: 'Berichtszugriff eingeschränkt',
      accessRestrictedDescription:
        'Payroll-Berichte sind für Manager, HR und Administratoren verfügbar.',
      workdayFallback: 'Arbeitstag',
      nonWorkingDayFallback: 'Nicht-Arbeitstag',
    },
    auditUi: {
      auditEvents: 'Audit-Ereignisse',
      auditEventsDescription:
        'Antrags-, Nutzer-, Richtlinien- und Zugriffsprotokolle',
      integrity: 'Integrität',
      valid: 'Gültig',
      review: 'Prüfen',
      chainedEventsChecked: '{{count}} verkettete Ereignisse geprüft',
      privacyViews: 'Datenschutzaufrufe',
      privacyViewsDescription: 'Wer sensible Audit-Bereiche geöffnet hat',
      consentRecords: 'Einwilligungsnachweise',
      consentRecordsDescription:
        'Verarbeitungszwecke pro Mitarbeiter nachverfolgt',
      aggregateFilter: 'Audit-Aggregat',
      actorFilter: 'Audit-Akteur',
      classificationFilter: 'Audit-Klassifikation',
      dataRequests: 'Datenanfragen',
      dataRequestsDescription:
        'Export-, Berichtigungs-, Einschränkungs- und Lösch-Workflows',
      auditTimeline: 'Audit-Verlauf',
      auditTimelineDescription:
        'Audit-Nachweise für HR/Admin filtern und exportieren.',
      searchPlaceholder: 'Akteur, Aktion, Datensatz, Zusammenfassung suchen...',
      allRecords: 'Alle Datensätze',
      allActors: 'Alle Akteure',
      allSensitivity: 'Alle Sensitivitäten',
      operational: 'Operativ',
      personalData: 'Personenbezogen',
      sensitive: 'Sensibel',
      system: 'System',
      when: 'Wann',
      actor: 'Akteur',
      action: 'Aktion',
      record: 'Datensatz',
      summary: 'Zusammenfassung',
      loadingAuditEvents: 'Audit-Ereignisse werden geladen',
      loadingAuditEventsDescription:
        'Lokale Audit-Daten, Datenschutzzugriffe und Integritätsmetadaten werden geprüft.',
      noAuditEvents: 'Keine Audit-Ereignisse für diese Filter',
      noAuditEventsDescription:
        'Filter erweitern oder Suche leeren, um mehr Audit- und Datenschutzdaten zu sehen.',
      resetFilters: 'Filter zurücksetzen',
      sealed: 'versiegelt',
      legacy: 'legacy',
      whoSawWhat: 'Wer hat was gesehen',
      whoSawWhatDescription:
        'Datenschutzzugriffsereignisse entstehen beim Öffnen sensibler Audit-Bereiche.',
      noPrivacyAccessEvents: 'Noch keine Datenschutzzugriffsereignisse.',
      retentionModel: 'Aufbewahrungsmodell',
      retentionYears: '{{count}} Jahre',
      dataSubjectRequests: 'Betroffenenanfragen',
      deleteIsGated: 'Löschen ist abgesichert',
      deleteIsGatedDescription:
        'Personenbezogene Daten dürfen nur unter Beachtung gesetzlicher Aufbewahrung gelöscht werden und laufen als Review-Workflow, nicht als Sofortaktion.',
      deleteAllowedAfterRetentionReview:
        'Nur nach Deaktivierung und Aufbewahrungsprüfung erlaubt.',
      immutableAuditChain: 'Unveränderliche Audit-Kette',
      privacyAccessLog: 'Datenschutzzugriffsprotokoll',
      globalAuditLog: 'Globales Audit-Protokoll',
      globalAuditLogDescription:
        'Antrags-, Nutzer-, Richtlinien- und Datenschutzzugriffsereignisse mit exportierbaren Nachweisen untersuchen.',
      policySettings: 'Richtlinieneinstellungen',
      auditAccessRestricted: 'Audit-Zugriff eingeschränkt',
      auditAccessRestrictedDescription:
        'Nur HR/Admin-Rollen dürfen volle Audit- und Datenschutz-Governance-Daten sehen.',
      auditIntegrityNeedsReview: 'Audit-Integrität braucht Prüfung',
      hrAdminRole: 'HR/Admin',
      openedGlobalPrivacyAuditLog:
        '{{name}} hat das globale Datenschutz-Audit-Protokoll geöffnet.',
    },
    teamAvailabilityUi: {
      accessRestricted: 'Team-Verfügbarkeit eingeschränkt',
      accessRestrictedDescription:
        'Team-Verfügbarkeit ist auf Manager, HR und Administratoren begrenzt. Mitarbeiter sehen Verfügbarkeitsinfos nur, wo ein richtlinienbasierter Workflow es erfordert.',
      availabilityForDate:
        'Verfügbarkeit für {{date}} mit datenschutzgerechten Details.',
      openPlanning: 'Planung öffnen',
      export: 'Exportieren',
      capacity: 'Kapazität',
      fteAvailableToday: 'Heute verfügbare FTE',
      remote: 'Remote',
      workingOutsideOffice: 'Arbeitet außerhalb des Büros',
      conflicts: 'Konflikte',
      belowStaffingRule: 'Unter Besetzungsregel',
      returningSoon: 'Bald zurück',
      withinNext7Days: 'Innerhalb der nächsten 7 Tage',
      privacyByDefault: 'Datenschutz als Standard',
      privacyByDefaultDescription:
        'Teamkollegen sehen nur den Verfügbarkeitsstatus. Manager sehen operative Planungsdetails, wo Richtlinien es erlauben. Vertrauliche Abwesenheitsgründe bleiben verborgen.',
      managePolicy: 'Richtlinie verwalten',
      loading: 'Team-Verfügbarkeit wird geladen',
      loadingDescription:
        'Verfügbarkeit, Rückkehrdaten, Kapazitätswarnungen und richtlinienkonforme Details werden vorbereitet.',
      overview: 'Übersicht',
      heatmap: 'Heatmap',
      unavailable: 'Nicht verfügbar',
      searchPlaceholder: 'Person oder Team suchen...',
      everyoneAvailable: 'Jeder in dieser gefilterten Ansicht ist verfügbar.',
      noReturns: 'Keine Rückkehr in den nächsten 7 Tagen.',
      adjustSearchDescription:
        'Suche, Teamfilter oder Planungszeitraum anpassen, um eine andere Verfügbarkeitsmenge zu sehen.',
      managerWarnings: 'Manager-Warnungen',
      staffingConflicts14Days: 'Besetzungskonflikte in den nächsten 14 Tagen.',
      conflictsCount: '{{count}} Konflikte',
      clear: 'Klar',
      noStaffingWarnings:
        'Keine Besetzungswarnungen für diese gefilterte Teamansicht.',
      exactlyMinimumStaffing:
        'Genau auf Mindestbesetzung: {{current}}/{{minimum}}.',
      noCapacityRows: 'Keine Kapazitätszeilen für diesen Filter',
      noCapacityRowsDescription:
        'Breitere Teamsuche nutzen, um Besetzung, Remote-Arbeit und Mindestabdeckung zu sehen.',
      scheduled: 'Geplant',
      available: 'Verfügbar',
      minimum: 'Minimum',
      decision: 'Entscheidung',
      statusAvailable: 'Verfügbar',
      statusRemote: 'Remote',
      statusUnavailable: 'Nicht verfügbar',
      statusAbsent: 'Abwesend',
      capacityStatus: {
        conflict: 'Konflikt',
        healthy: 'Gesund',
        tight: 'Knapp',
      },
      onsite: 'vor Ort',
      departmentHeatmap: 'Abteilungs-Heatmap',
      heatmapDescription:
        'Grün ist gesund, Gelb ist am Minimum, Rot braucht Manager-Aktion.',
      healthy: 'Gesund',
      tight: 'Knapp',
      conflict: 'Konflikt',
      staff: 'Mitarbeiter',
      noSchedule: 'kein Plan',
      noPeopleInAvailabilityView:
        'Keine Personen in dieser Verfügbarkeitsansicht',
      visibleDetail: 'Sichtbares Detail',
      until: 'Bis',
      nextWorkingDay: 'Nächster Arbeitstag',
      workPattern: 'Arbeitsmuster',
      csvHeaders: {
        date: 'Datum',
        team: 'Team',
        scheduled: 'Geplant',
        available: 'Verfügbar',
        remote: 'Remote',
        unavailable: 'Nicht verfügbar',
        capacityFte: 'Kapazität FTE',
        minimumStaff: 'Mindestbesetzung',
        minimumOnsite: 'Mindest vor Ort',
        status: 'Status',
        warnings: 'Warnungen',
      },
    },
    planningUi: {
      accessRestricted: 'Planungszugriff eingeschränkt',
      accessRestrictedDescription:
        'Die Personalplanung enthält operative Teamkapazität, Abdeckung und Auswirkungen von Freigaben. Mitarbeiter können Anträge und Meine Zeit für ihren eigenen Ablauf nutzen.',
      subtitle:
        'Plane persönliche Abwesenheiten und verstehe die Teamverfügbarkeit an einem Ort.',
      remoteDays: 'Remote-Tage',
      leaveDays: 'Abwesenheitstage',
      approvedOrPlanned: 'Genehmigt oder geplant',
      capacityForecast: 'Kapazitätsprognose',
      confidential: 'Vertraulich',
      detailsHiddenByPolicy: 'Details durch Richtlinie ausgeblendet',
      loading: 'Planungsdaten werden geladen',
      loadingDescription:
        'Kalender, Richtlinienmaskierung, Kapazitätsprognose und Freigabe-Auswirkungssimulation werden vorbereitet.',
      myCalendar: 'Mein Kalender',
      teamCalendar: 'Teamkalender',
      forecast: 'Prognose',
      cover: 'Abdeckung',
      impact: 'Auswirkung',
      calendarOwner: 'Kalenderinhaber',
      switchBetweenPeople: 'Zwischen Personen mit Zugriff wechseln.',
      reviewRequests: 'Anträge prüfen',
      personalPlanningYearStarting: 'Persönliches Planungsjahr ab',
      teamAvailabilityDescription:
        'Monatsübersicht mit ausstehenden und vertraulichen Abwesenheiten.',
      searchTeam: 'Team suchen...',
      capacityForecastDescription:
        'Prognose basierend auf Arbeitsmustern, Feiertagen, Anträgen und Besetzungsregeln.',
      schedulingModel: 'Planungsmodell',
      schedulingModelDescription:
        'Aktuelle Arbeitsmuster-Annahmen, die in der Prognose verwendet werden.',
      workdays: 'Arbeitstage',
      onDemand: 'Bei Bedarf',
      forecastConflictsNeedReview:
        '{{count}} Prognosekonflikte benötigen Manager-Prüfung.',
      whoCanCoverThisDay: 'Wer kann diesen Tag abdecken?',
      selectedTeam: 'Ausgewähltes Team',
      noCoverCandidates: 'Keine Vertretungskandidaten für diesen Tag',
      noCoverCandidatesDescription:
        'Versuche ein anderes Team oder Datum oder prüfe die Besetzungsregel vor der Genehmigung weiterer Abwesenheiten.',
      capacityValue: 'Kapazität {{value}} FTE',
      noApprovalImpact: 'Keine Freigabe-Auswirkung zu simulieren',
      noApprovalImpactDescription:
        'Ausstehende Abwesenheits- und Homeoffice-Anträge erscheinen hier, damit Manager die Besetzungsauswirkung vor der Genehmigung prüfen können.',
      belowMinimumStaffingSentence:
        '{{team}} liegt unter der Mindestbesetzung: {{current}}/{{minimum}}.',
      requiredOnsiteStaffSentence:
        '{{team}} hat {{current}}/{{minimum}} erforderliche Vor-Ort-Mitarbeiter.',
      noConflict: 'Kein Konflikt',
      staffed: 'besetzt',
      openApprovalQueue: 'Freigabewarteschlange öffnen',
      people: 'Personen',
      calendarWeek: 'Kalenderwoche',
      calendarWeekShort: 'KW',
      day: 'Tag',
      weekday: 'Wochentag',
      vacationPlanned: 'Geplanter Urlaub',
      homeOfficeDays: 'Homeoffice-Tage',
      pendingLabel: 'Ausstehend',
      absenceLabels: {
        homeOffice: 'Homeoffice',
        vacation: 'Urlaub',
        sickLeave: 'Krankheit',
        timeOff: 'Freistellung',
        unavailable: 'Nicht verfügbar',
      },
      fit: {
        strong: 'stark',
        possible: 'möglich',
        unavailable: 'nicht verfügbar',
      },
      csvHeaders: {
        date: 'Datum',
        employee: 'Mitarbeiter',
        team: 'Team',
        role: 'Rolle',
        dayType: 'Tagestyp',
        statusCode: 'Statuscode',
        status: 'Status',
        category: 'Kategorie',
        pending: 'Ausstehend',
        confidential: 'Vertraulich',
        holiday: 'Feiertag',
      },
      fallbackStatus: 'Status {{code}}',
      workPatternLabels: {
        partTime: 'Teilzeit',
        onDemand: 'Bei Bedarf',
        hybrid: 'Hybrid',
        officeFirst: 'Büro zuerst',
        fullTime: 'Vollzeit',
      },
      coverageReasons: {
        notScheduledByWorkPattern: 'Nicht laut Arbeitsmuster eingeplant',
        alreadyUnavailable: 'Bereits nicht verfügbar',
        sameTeamAndAvailable: 'Gleiches Team und verfügbar',
        availableCrossTeamCover: 'Als teamübergreifende Vertretung verfügbar',
      },
    },
    attendanceUi: {
      approvalAutomation: 'Freigabeautomatisierung',
      approvalAutomationDescription:
        'Automatisch freigegebene Änderungen bleiben auditierbar und unter Anträge sichtbar.',
      autoApproveBookingCorrections:
        'Buchungskorrekturen automatisch freigeben',
      autoApproveCorrectionThreshold:
        'Schwellwert für kleine Korrekturen, Minuten',
      autoApproveCorrectionThresholdDescription:
        'Nur Buchungskorrekturen bis zu dieser gesamten Zeitänderung können automatisch freigegeben werden.',
      autoApproveNonRequiredAbsences:
        'Abwesenheitsarten ohne Freigabepflicht automatisch freigeben',
      attendancePolicies: 'Anwesenheitsrichtlinien',
      attendancePoliciesDescription:
        'Abwesenheits-/Statusarten und Datenschutzsichtbarkeit für Manager, Teamkollegen, HR und Administratoren verwalten.',
      privacyDescription:
        'Anwesenheitsdaten können personenbezogene Informationen wie Arbeitsmuster, Abwesenheitsdaten und Krankheit offenlegen. Konfiguriere für jeden Status die engste sinnvolle Sichtbarkeit und behalte volle Details für HR/Admin-Auditzwecke.',
      policyChangesLocked: 'Richtlinienänderungen sind gesperrt',
      statuses: 'Statusarten',
      rulesEngine: 'Regelwerk',
      visibility: 'Sichtbarkeit',
      absenceStatusTypes: 'Abwesenheits- und Statusarten',
      absenceStatusTypesDescription:
        'Codes erstellen, aktualisieren oder entfernen, die in Anträgen und Kalendern verfügbar sind.',
      newStatus: 'Neuer Status',
      code: 'Code',
      name: 'Name',
      category: 'Kategorie',
      teammate: 'Teamkollege',
      hrAdmin: 'HR/Admin',
      loadingPolicies: 'Anwesenheitsrichtlinien werden geladen',
      loadingPoliciesDescription:
        'Statusarten, Sichtbarkeitsregeln, Feiertagskalender und Richtlinienvalidierung werden vorbereitet.',
      deleteStatusQuestion: '{{label}} löschen?',
      deleteStatusDescription:
        'Dies entfernt den Status aus neuen Anträgen und Planungsansichten. Bestehende synchronisierte Historie soll im Backend prüfbar bleiben.',
      keepStatus: 'Status behalten',
      policyRulesEngine: 'Richtlinien-Regelwerk',
      policyRulesEngineDescription:
        'Ein Ort für gesetzliche Pausen, Feiertagskalender, Arbeitszeit-Standards, Urlaubsübertrag und sensible Krankheitsbehandlung.',
      legalBreakRules: 'Gesetzliche Pausenregeln',
      rulesEvaluatedDescription: 'Regeln werden gegen Arbeitszeit geprüft',
      holidayCalendar: 'Feiertagskalender',
      vacationEntitlement: 'Urlaubsanspruch',
      beforeCarryoverUsage: 'Vor Übertrag und Nutzung',
      countryRegion: 'Land / Region',
      holidayLocalScope: 'Feiertags- und lokale Regelreichweite',
      weeklyHours: 'Wochenstunden',
      defaultWorkingTimeContract: 'Standard-Arbeitszeitvertrag',
      carryover: 'Übertrag',
      appliedBeforeVisibility: 'Wird vor Sichtbarkeitsregeln angewendet',
      breakRules: 'Pausenregeln',
      afterHoursRule: 'Nach {{hours}}h: {{minutes}}m',
      editRules: 'Regeln bearbeiten',
      holidayCalendarDescription:
        'Gesetzliche und firmeninterne Tage, die in Zeiterfassung und Planung verwendet werden.',
      workingTimeModel: 'Arbeitszeitmodell',
      workingTimeModelDescription:
        'Standardvertrag, der erstellt wird, wenn ein Mitarbeiter noch keinen expliziten Vertrag hat.',
      workdays: 'Arbeitstage',
      off: 'Aus',
      rulePreview: 'Regelvorschau',
      rulePreviewDescription:
        'Beispielprüfungen, die der Antragsworkflow vor Einreichung oder Freigabe nutzen kann.',
      vacationDaysRemaining: '{{count}} Urlaubstage verbleibend',
      carryoverSummary:
        'Enthält {{available}} Übertragstage. Verfallen: {{expired}}.',
      sicknessVisibilityPreview: 'Vorschau Krankheitssichtbarkeit',
      visibilityModel: 'Sichtbarkeitsmodell',
      visibilityModelDescription:
        'Die App sollte pro Betrachterrolle nur die erforderlichen Informationen zeigen.',
      viewer: 'Betrachter',
      visibleInformation: 'Sichtbare Informationen',
      visibilityHidden: 'Verborgen',
      visibilityStateOnly: 'Nur Status',
      visibilityOperational: 'Operative Details',
      visibilityFull: 'Vollständige Details',
      categoryRemote: 'Remote',
      categoryLeave: 'Abwesenheit',
      categoryUnavailable: 'Nicht verfügbar',
      categorySickness: 'Krankheit',
      categoryCustom: 'Benutzerdefiniert',
      viewerEmployee: 'Mitarbeiter',
      viewerTeammate: 'Teamkollege',
      viewerManager: 'Manager',
      viewerHrAdmin: 'HR/Admin',
      defaultTypeHomeOffice: 'Homeoffice',
      defaultTypeVacation: 'Urlaub',
      defaultTypeUnavailable: 'Nicht verfügbar',
      defaultTypeSickLeave: 'Krankheit',
      companyClosingDay: 'Firmenschließtag',
      vacationBalanceExceededTitle: 'Urlaubssaldo überschritten',
      vacationBalanceExceededMessage:
        'Der Antrag benötigt {{requestedDays}} Tage, aber nur {{remainingDays}} Tage sind verfügbar.',
      carryoverExpiredTitle: 'Übertrag abgelaufen',
      carryoverExpiredMessage:
        '{{carryoverExpiredDays}} Übertragungstage sind nach dem Firmenablaufdatum nicht mehr nutzbar.',
      sicknessPrivacyEnforcedTitle: 'Krankheitsdatenschutz aktiv',
      sicknessPrivacyEnforcedMessage:
        'Teamkollegen sehen diesen Status nicht. Manager sehen nur den Verfügbarkeitsstatus; HR/Admin behält die Audit-Details.',
      visibilityModelEmployee:
        'Eigene Buchungen, Antragsgründe und Entscheidungsverläufe.',
      visibilityModelTeammate:
        'Verfügbar, nicht verfügbar oder remote nur, wenn die Richtlinie es erlaubt.',
      visibilityModelManager:
        'Genehmigte operative Details, die für die Planung nötig sind.',
      visibilityModelHrAdmin:
        'Vollständige Antragsdetails, Audit-Trail und Richtlinienkonfiguration.',
      updateAbsenceStatusType: 'Abwesenheits-/Statusart aktualisieren',
      createAbsenceStatusType: 'Abwesenheits-/Statusart erstellen',
      statusTypeDrawerDescription:
        'Code, Kategorie, Sichtbarkeit, Freigabe- und Auditregeln konfigurieren, die in Anträgen, Planung und Zeiterfassung verwendet werden.',
      localFirstPolicyMeta:
        'Local-first-Änderung. Gespeicherte Richtlinienupdates werden für Sync und Audit vorgemerkt.',
      reset: 'Zurücksetzen',
      createStatus: 'Status erstellen',
      color: 'Farbe',
      teammatesSee: 'Teamkollegen sehen',
      managersSee: 'Manager sehen',
      hrAdminSee: 'HR/Admin sehen',
      requiresApproval: 'Freigabe erforderlich',
      auditRequired: 'Audit erforderlich',
      updateAttendanceRules: 'Anwesenheitsregeln aktualisieren',
      updateAttendanceRulesDescription:
        'Firmenweite Richtlinien-Standards pflegen, die von Anträgen, Zeiterfassung, Planung, Compliance-Prüfungen und Datenschutz verwendet werden.',
      savedRulesMeta:
        'Gespeicherte Regeln aktualisieren den lokalen Richtlinienspeicher und werden zur Synchronisierung vorgemerkt.',
      saveRules: 'Regeln speichern',
      periodGovernance: 'Periodensteuerung',
      periodGovernanceDescription:
        'Steuere, wie weit jedes Modul zurück und nach vorn navigieren darf.',
      monthsBack: 'Monate zurück',
      monthsForward: 'Monate nach vorn',
      country: 'Land',
      region: 'Region',
      defaultWeeklyHours: 'Standard-Wochenstunden',
      defaultWorkdays: 'Standard-Arbeitstage',
      addWorkday: 'Arbeitstag hinzufügen',
      noDefaultWorkdays: 'Keine Standard-Arbeitstage ausgewählt.',
      clearWorkdays: 'Arbeitstage leeren',
      allowVacationCarryover: 'Urlaubsübertrag erlauben',
      maxCarryoverDays: 'Maximale Übertragstage',
      carryoverExpiry: 'Übertragsablauf',
      carryoverExpiryPlaceholder: 'TT.MM',
      daysCount: '{{count}} Tage',
      expiresOn: 'Ablauf {{date}}',
      unableToSaveAttendanceType:
        'Abwesenheits-/Statustyp konnte nicht gespeichert werden.',
      unableToDeleteAttendanceType:
        'Abwesenheits-/Statustyp konnte nicht gelöscht werden.',
      attendancePolicyRulesSaved: 'Anwesenheitsrichtlinien gespeichert.',
      unableToSaveAttendancePolicyRules:
        'Anwesenheitsrichtlinien konnten nicht gespeichert werden.',
      sicknessPrivacy: 'Krankheitsdatenschutz',
      sicknessPrivacyMode: 'Krankheitsdatenschutzmodus',
      medicalConfidential: 'Medizinisch vertraulich',
      managerOperational: 'Manager operativ',
      standardVisibility: 'Standard-Sichtbarkeit',
      currentTeam: 'Aktuelles Team',
      configuredManager: 'Konfigurierter Manager',
      fullTime40h: 'Vollzeit · 40h',
      currentSession: 'Aktuelle Sitzung',
      legalBreakRulesDescription:
        'Diese Regeln werden von Zeiterfassung und Compliance-Berichten ausgewertet.',
      monday: 'Montag',
      tuesday: 'Dienstag',
      wednesday: 'Mittwoch',
      thursday: 'Donnerstag',
      friday: 'Freitag',
      saturday: 'Samstag',
      sunday: 'Sonntag',
    },
    usersUi: {
      selectAllRows: 'Alle Zeilen auswählen',
      selectRow: 'Zeile auswählen',
      person: 'Person',
      contact: 'Kontakt',
      team: 'Team',
      manager: 'Manager',
      status: 'Status',
      role: 'Rolle',
      workPattern: 'Arbeitsmuster',
      activity: 'Aktivität',
      invitationPending: 'Einladung ausstehend',
      reviewDate: 'Prüfung {{date}}',
      lifecycle: {
        active:
          'Aktiver Zugang. Historische Datensätze bleiben diesem Mitarbeiter zugeordnet.',
        invited: 'Der Zugang beginnt erst nach Annahme der Einladung.',
        retention: 'Historische Zeiterfassung aufbewahren bis {{date}}.',
        suspended:
          'Der Zugang ist gesperrt, bis eine Administratorin oder ein Administrator die Prüfung abschließt.',
      },
      filterUsers: 'Nutzer filtern...',
      active: 'Aktiv',
      inactive: 'Inaktiv',
      invited: 'Eingeladen',
      suspended: 'Gesperrt',
      noEmployeesMatch: 'Keine Mitarbeiter passen zu dieser Ansicht',
      noEmployeesMatchDescription:
        'Suche leeren oder Tabellenfilter anpassen, um Mitarbeiter wieder im Verzeichnis zu sehen.',
      openMenu: 'Menü öffnen',
      reactivate: 'Reaktivieren',
      resendInvitation: 'Einladung erneut senden',
      invitationResent: 'Neuer Einladungslink an {{email}} gesendet.',
      deactivate: 'Deaktivieren',
      employeeSaved: 'Mitarbeiter gespeichert.',
      unableSaveEmployee: 'Mitarbeiter konnte nicht gespeichert werden.',
      employeeDeactivated:
        'Mitarbeiter deaktiviert. Historische Daten bleiben erhalten.',
      unableDeactivateEmployee: 'Mitarbeiter konnte nicht deaktiviert werden.',
      employeeReactivated: 'Mitarbeiter reaktiviert.',
      unableReactivateEmployee: 'Mitarbeiter konnte nicht reaktiviert werden.',
      invitationQueued: 'Einladung in Warteschlange.',
      unableInviteEmployee: 'Mitarbeiter konnte nicht eingeladen werden.',
      delegationUpdated: 'Delegation aktualisiert.',
      unableSaveDelegation: 'Delegation konnte nicht gespeichert werden.',
      editEmployeeAccess: 'Mitarbeiterzugang bearbeiten',
      createEmployeeProfile: 'Mitarbeiterprofil erstellen',
      employeeProfileDescription:
        'Rolle, Team, Manager und Sichtbarkeit an die reale Planungsverantwortung des Mitarbeiters anpassen.',
      newEmployee: 'Neuer Mitarbeiter',
      lastUpdated: 'Zuletzt aktualisiert {{date}}',
      localFirstChange:
        'Local-first Änderung. Gespeicherte Datensätze werden zur Synchronisierung vorgemerkt.',
      saveChanges: 'Änderungen speichern',
      firstName: 'Vorname',
      firstNamePlaceholder: 'Max',
      lastName: 'Nachname',
      lastNamePlaceholder: 'Mustermann',
      username: 'Benutzername',
      usernamePlaceholder: 'max_m',
      emailPlaceholder: 'max.mustermann@gmail.com',
      phoneNumber: 'Telefonnummer',
      phonePlaceholder: '+49123456789',
      selectRole: 'Rolle wählen',
      teamPlaceholder: 'Operations',
      managerPlaceholder: 'Anna König',
      workPatternPlaceholder: 'Vollzeit · Flex',
      visibility: 'Sichtbarkeit',
      selectVisibleData: 'Sichtbare Daten wählen',
      availabilityOnly: 'Nur Verfügbarkeit',
      teamPlanningDetails: 'Team-Planungsdetails',
      requestDetailsAuditTrail: 'Antragsdetails und Audit-Trail',
      policyIntegrationAdministration:
        'Richtlinien- und Integrationsverwaltung',
      fullPlatformAdministration: 'Vollständige Plattformverwaltung',
      passwordPlaceholder: 'z. B. S3cur3P@ssw0rd',
      confirmPassword: 'Passwort bestätigen',
      inviteEmployee: 'Mitarbeiter einladen',
      inviteEmployeeDescription:
        'Sichere Einladung senden und die minimale Rolle für die Arbeit des Mitarbeiters zuweisen.',
      invitation: 'Einladung',
      inviteMeta:
        'Erstellt jetzt einen lokalen Einladungseintrag und kann später mit E-Mail-Versand verbunden werden, sobald das Backend bereit ist.',
      invite: 'Einladen',
      inviteEmailPlaceholder: 'anna.queen@company.com',
      descriptionOptional: 'Beschreibung (optional)',
      descriptionPlaceholder:
        'Onboarding-Kontext oder erste Teamzuweisung hinzufügen',
      addEmployee: 'Mitarbeiter hinzufügen',
      adminWorkspace: 'Admin-Arbeitsbereich',
      privacyAwareAccess: 'Datenschutzbewusster Zugriff',
      peopleAndAccess: 'Personen und Zugriff',
      peopleAndAccessDescription:
        'Mitarbeiter, Manager, HR-Zugriff und die Sichtbarkeit verwalten, die jede Rolle für die Anwesenheitsplanung benötigt.',
      readOnlyAccess: 'Nur-Lese-Zugriff',
      readOnlyAccessDescription:
        'Ihre Rolle kann eingeschränkte Mitarbeiterverfügbarkeit sehen, aber keine Zugriffe erstellen, aktualisieren oder entfernen.',
      directory: 'Verzeichnis',
      permissions: 'Berechtigungen',
      loadingEmployeeDirectory: 'Mitarbeiterverzeichnis wird geladen',
      loadingEmployeeDirectoryDescription:
        'Personen, Teams, Lebenszyklusstatus, Anmeldedaten und effektive Berechtigungen werden vorbereitet.',
      activeEmployees: 'Aktive Mitarbeiter',
      activeEmployeesDescription: 'Aktuell in der Planung enthaltene Personen',
      managersDescription: 'Kann operative Planungsdetails sehen',
      privilegedAccess: 'Privilegierter Zugriff',
      privilegedAccessDescription: 'Admin- und HR-Nutzer auf Audit-Ebene',
      pendingInvites: 'Ausstehende Einladungen',
      pendingInvitesDescription: 'Benötigen Abschluss des Onboardings',
      approvalDelegation: 'Freigabedelegation',
      approvalDelegationDescription:
        'Manager-Vertretungsteams für Freigaben und Sichtbarkeit der Antragswarteschlange konfigurieren.',
      selectManager: 'Manager auswählen',
      addDelegatedTeam: 'Delegiertes Team hinzufügen',
      noDelegatedTeams: 'Keine delegierten Teams ausgewählt.',
      clearTeams: 'Teams leeren',
      saveDelegation: 'Delegation speichern',
      noUsersAvailable: 'Keine Nutzer verfügbar',
      noUsersAvailableDescription:
        'Erstellen oder importieren Sie Mitarbeiter, bevor Sie effektive Berechtigungen und Zugriffsumfang prüfen.',
      effectivePermissions: 'Effektive Berechtigungen',
      frontendContract: 'Frontend-Vertrag',
      signedInSession: 'Angemeldete Sitzung',
      effectivePermissionsDescription:
        'Rollenberechtigungen werden mit Lebenszyklusstatus berechnet, bevor die UI sensible Aktionen aktiviert. Ein Backend kann denselben DTO-Vertrag verwenden.',
      grantedPermissions: 'Gewährte Berechtigungen',
      sourceRoleLifecycle: 'Quelle: Rolle {{role}} plus Lebenszyklusrichtlinie',
      lifecyclePolicy: 'Lebenszyklusrichtlinie',
      accessBlockedByLifecycle: 'Zugriff durch Lebenszyklusstatus blockiert',
      granted: 'Gewährt',
      blocked: 'Blockiert',
      whatUserCanDo: 'Was dieser Nutzer tun kann',
      noActivePermissions:
        'Keine aktiven Berechtigungen. Der Nutzer ist nicht produktionsfähig.',
      whyActionsHidden: 'Warum Aktionen ausgeblendet sind',
      inviteSelectedUsers: 'Ausgewählte Nutzer einladen',
      activateSelectedUsers: 'Ausgewählte Nutzer aktivieren',
      deactivateSelectedUsers: 'Ausgewählte Nutzer deaktivieren',
      invitingUsers: 'Nutzer werden eingeladen...',
      invitedUsersCount: '{{count}} Nutzer eingeladen',
      errorInvitingUsers: 'Fehler beim Einladen von Nutzern',
      reactivatedSelectedUsers: '{{count}} ausgewählte Nutzer reaktiviert.',
      deactivatedSelectedUsers: '{{count}} ausgewählte Nutzer deaktiviert.',
      bulkDeactivationReason:
        'Sammeldeaktivierung aus dem Personen-Arbeitsbereich',
      deactivateUser: 'Nutzer deaktivieren',
      deactivateUserQuestion:
        '{{username}} deaktivieren? Der Nutzer behält die Rolle {{role}} für historische Berichte, aber Anmeldung und produktive Berechtigungen werden deaktiviert.',
      enterUsernameToConfirm:
        'Benutzernamen zur Bestätigung der Deaktivierung eingeben.',
      reason: 'Grund',
      optionalDeactivationReason:
        'Optionaler Deaktivierungsgrund für den Audit-Trail.',
      historicalRetention: 'Historische Aufbewahrung',
      historicalRetentionDescription:
        'Anwesenheit, Anträge, Freigaben und Audit-Ereignisse bleiben mit diesem Mitarbeiter verknüpft. Dies ist eine Lebenszyklusänderung, keine harte Löschung.',
      inspectUser: 'Nutzer prüfen',
      hrRole: 'HR',
      superadminRole: 'Superadmin',
      permissionGroups: {
        attendance: 'Anwesenheit',
        requests: 'Anträge',
        planning: 'Planung',
        timesheets: 'Zeiterfassungen',
        people: 'Personen',
        platform: 'Plattform',
      },
      permissionLabels: {
        clockOwnTime: 'Eigene Zeit erfassen',
        requestOwnCorrections: 'Eigene Korrekturen beantragen',
        createOwnRequests: 'Eigene Anträge erstellen',
        approveTeamRequests: 'Team-Anträge freigeben',
        viewFullRequestDetail: 'Vollständige Antragsdetails ansehen',
        viewTeamPlanning: 'Team-Planung ansehen',
        manageCapacityRules: 'Kapazitätsregeln verwalten',
        viewOwnTimesheet: 'Eigene Zeiterfassung ansehen',
        viewTeamTimesheets: 'Team-Zeiterfassungen ansehen',
        approveTeamTimesheets: 'Team-Zeiterfassungen freigeben',
        exportPayrollData: 'Payroll-Daten exportieren',
        viewPeopleDirectory: 'Personenverzeichnis ansehen',
        manageUsers: 'Nutzer verwalten',
        deactivateUsers: 'Nutzer deaktivieren',
        inspectEffectivePermissions: 'Effektive Berechtigungen prüfen',
        managePolicies: 'Richtlinien verwalten',
        viewFullAudit: 'Vollständiges Audit ansehen',
        manageLocalSyncData: 'Lokale Sync-Daten verwalten',
      },
      permissionDescriptions: {
        clockOwnTime:
          'Ein- und ausstempeln sowie den persönlichen Pausenstatus verwalten.',
        requestOwnCorrections:
          'Korrekturanträge für fehlende Zeiten oder Zeitereignisse einreichen.',
        createOwnRequests:
          'Urlaub, Homeoffice und offizielle Abwesenheiten beantragen.',
        approveTeamRequests:
          'Anträge für operativ betreute Teams freigeben oder ablehnen.',
        viewFullRequestDetail:
          'Antragsgründe, Anhänge, Auditudaten und Richtlinienkontext sehen.',
        viewTeamPlanning:
          'Operative Teamverfügbarkeit und Kapazitätsprognosen sehen.',
        manageCapacityRules: 'Mindestbesetzung und Planungsannahmen anpassen.',
        viewOwnTimesheet: 'Eigene monatliche Anwesenheit und Salden prüfen.',
        viewTeamTimesheets:
          'Zeiterfassungen der Mitarbeitenden für die Teamfreigabe prüfen.',
        approveTeamTimesheets:
          'Monatliche Team-Zeiterfassungen signieren und sperren.',
        exportPayrollData: 'Payroll-fähige Anwesenheitsexporte erzeugen.',
        viewPeopleDirectory: 'Den Bereich Personen und Zugriff öffnen.',
        manageUsers:
          'Nutzer anlegen, Rollen, Teams und Profildaten aktualisieren.',
        deactivateUsers:
          'Zugriff entfernen und historische Anwesenheitsdaten behalten.',
        inspectEffectivePermissions:
          'Die finalen Berechtigungen nach Rollen- und Lebenszyklusregeln sehen.',
        managePolicies:
          'Abwesenheitsstatus, Sichtbarkeit und Anwesenheitsrichtlinien pflegen.',
        viewFullAudit:
          'Sensible Audit-Ereignisse und historische Antragsdetails ansehen.',
        manageLocalSyncData:
          'Lokale Daten prüfen, zurücksetzen, importieren, exportieren und erneut versuchen.',
      },
      permissionReasons: {
        roleGrants: 'Die Rolle {{role}} gewährt diese Berechtigung.',
        roleDoesNotInclude:
          'Die Rolle {{role}} enthält diese Berechtigung nicht.',
      },
      permissionLifecycle: {
        activeUsersReceivePermissions:
          'Aktive Nutzer erhalten Berechtigungen aus ihrer zugewiesenen Rolle.',
        invited:
          'Die Einladung steht noch aus, daher sind noch keine Produktivrechte aktiv.',
        suspended:
          'Das Konto ist gesperrt. Der Zugriff bleibt blockiert, bis ein Administrator prüft.',
        inactive:
          'Das Konto ist inaktiv. Historische Daten bleiben erhalten, der Zugriff ist jedoch deaktiviert.',
      },
      auditSummaries: {
        profileUpdated: 'Profil von {{name}} wurde aktualisiert.',
        deactivatedWithRetention:
          '{{name}} wurde mit historischer Aufbewahrung deaktiviert.',
        reactivated: '{{name}} wurde reaktiviert.',
      },
      localSessionActor: 'Lokale Sitzung',
      searchTeams: 'Teams suchen',
      noTeamsFound: 'Keine Teams gefunden.',
      searchManagers: 'Manager suchen',
      noManagersFound: 'Keine Manager gefunden.',
      searchWorkPatterns: 'Arbeitsmuster suchen',
      noWorkPatternsFound: 'Keine Arbeitsmuster gefunden.',
      organization: 'Organisation',
      loadingOrganization: 'Organisationsdaten werden geladen',
      loadingOrganizationDescription:
        'Rollenprofile, Teams, Manager und Arbeitsmuster werden vorbereitet.',
      roleProfiles: 'Rollenprofile',
      roleProfilesDescription:
        'Verwalte zuweisbare Rollenprofile, die auf das System-Berechtigungsmodell abgebildet werden.',
      teams: 'Teams',
      teamsDescription:
        'Pflege Teamverantwortung und auswählbare Organisationsstruktur für Mitarbeitende.',
      workPatterns: 'Arbeitsmuster',
      workPatternsDescription:
        'Halte wiederverwendbare Arbeitsmodelle für Mitarbeitende und Planung konsistent.',
      departments: 'Abteilungen',
      departmentsDescription:
        'Abteilungen für Teams und Mitarbeiterzuweisungen.',
      locations: 'Standorte',
      locationsDescription:
        'Büro- und Regionalstandorte für Mitarbeiterzuweisungen.',
      managersDescriptionLong:
        'Manager sind Personen mit einer Manager-Rolle. Konfiguriere hier ihre primäre Teamverantwortung und delegierte Freigabebereiche.',
      code: 'Code',
      name: 'Name',
      timeZone: 'Zeitzone',
      baseRole: 'Basisrolle',
      newDepartment: 'Neue Abteilung',
      newLocation: 'Neuer Standort',
      newRoleProfile: 'Neues Rollenprofil',
      newTeam: 'Neues Team',
      newWorkPattern: 'Neues Arbeitsmuster',
      addManager: 'Manager anlegen',
      primaryTeamOwnership: 'Primäre Teamverantwortung',
      primaryTeamOwnershipDescription:
        'Teams, die diesem Manager direkt als operativer Verantwortlicher zugewiesen sind.',
      noPrimaryTeams: 'Keine primären Teams zugewiesen',
      noPrimaryTeamsDescription:
        'Weise einem Team im Teamkatalog einen Manager zu, um die Verantwortung klar festzulegen.',
      delegatedTeams: 'Delegierte Teams',
      delegatedTeamsDescription:
        'Optionale Vertretungsteams, die dieser Manager freigeben oder prüfen darf.',
      organizationDrawerDescription:
        'Verwalte wiederverwendbare Katalogdaten für Personen-, Planungs- und Zugriffsabläufe.',
      label: 'Bezeichnung',
      description: 'Beschreibung',
      weeklyHours: 'Wochenstunden',
      activeCatalogEntry: 'Aktiver Katalogeintrag',
      activeCatalogEntryDescription:
        'Archivierte Einträge bleiben in historischen Datensätzen erhalten, werden aber nicht mehr für neue Auswahlen angeboten.',
      editDepartment: 'Abteilung bearbeiten',
      editLocation: 'Standort bearbeiten',
      editRoleProfile: 'Rollenprofil bearbeiten',
      editTeam: 'Team bearbeiten',
      editWorkPattern: 'Arbeitsmuster bearbeiten',
      organizationSaved: 'Organisationsdaten gespeichert.',
      organizationSaveFailed:
        'Organisationsdaten konnten nicht gespeichert werden.',
      searchRoleProfiles: 'Rollenprofile suchen',
      noRoleProfilesFound: 'Keine Rollenprofile gefunden.',
      noManagersFoundDescription:
        'Lege einen Manager an oder befördere einen bestehenden Mitarbeitenden für Team- und Freigabeverantwortung.',
      roleProfileDescriptions: {
        superadmin:
          'Volle Plattformkontrolle inklusive Audit- und Local-Sync-Verwaltung.',
        admin: 'Plattformbetrieb, Konfiguration und Local-first-Wartung.',
        hr: 'Sensibler Zugriff auf Mitarbeitende, Anträge und Audits für People Operations.',
        manager:
          'Teamfreigaben, Planungssicht und monatliche Sign-off-Verantwortung.',
        employee:
          'Self-Service-Zugriff auf Anwesenheit, Anträge und Zeiterfassung.',
      },
      organizationAudit: {
        catalogUpdated: 'Organisationseintrag {{label}} wurde aktualisiert.',
      },
    },
    syncUi: {
      openSyncStatus: 'Sync-Status öffnen',
      syncStatus: 'Sync-Status',
      localSync: 'Lokale Synchronisierung',
      queueHealthDescription: 'Warteschlangenstatus für Offline-Änderungen.',
      offline: 'Offline',
      conflict: 'Konflikt',
      needsRetry: 'Wiederholung nötig',
      healthy: 'Gesund',
      pending: 'Ausstehend',
      failed: 'Fehlgeschlagen',
      online: 'Online',
      no: 'Nein',
      yes: 'Ja',
      lastSync: 'Letzte Synchronisierung:',
      notSyncedYet: 'Noch nicht synchronisiert',
      retry: 'Wiederholen',
      offlineQueueHint:
        'Änderungen sind auf diesem Gerät gespeichert und werden automatisch synchronisiert, sobald die API wieder erreichbar ist.',
      pendingQueueHint:
        'Lokale Änderungen warten auf die Synchronisierung. Du kannst weiterarbeiten, während FlowPro im Hintergrund erneut versucht.',
      failedQueueHint:
        'Die Synchronisierung benötigt Aufmerksamkeit. Prüfe wartende Einträge oder wiederhole den Sync bei stabiler Verbindung.',
      localData: 'Lokale Daten',
      exportLocalData: 'Lokale Daten exportieren',
      importLocalData: 'Lokale Daten importieren',
      resetLocalData: 'Lokale Daten zurücksetzen',
      resetLocalFlowProDataQuestion: 'Lokale FlowPro-Daten zurücksetzen?',
      resetLocalDataDescription:
        'Dies löscht IndexedDB auf diesem Gerät, einschließlich Seed-Mitarbeitern, Anträgen, Richtlinien, Zeitereignissen, Sync-Metadaten und Warteschlangenoperationen. Die App lädt neu und erstellt Seed-Daten erneut.',
      cancel: 'Abbrechen',
      schemaMigration: 'Schema-Migration',
      upgradedFromToSession:
        'In dieser Sitzung von v{{fromVersion}} auf v{{toVersion}} aktualisiert.',
      noQueuedLocalChanges: 'Keine lokalen Änderungen in der Warteschlange.',
      queuedRecordHint: 'Lokaler Datensatz {{record}}',
      details: 'Details',
      operationDetails: 'Operationsdetails',
      inspectQueuedChangesDescription:
        'Local-first Änderungen in der Warteschlange vor der Synchronisierung prüfen.',
      type: 'Typ',
      status: 'Status',
      aggregate: 'Aggregat',
      record: 'Datensatz',
      attempts: 'Versuche',
      created: 'Erstellt',
      keepLocal: 'Lokal behalten',
      acceptRemote: 'Remote übernehmen',
      cancelOperation: 'Operation abbrechen',
      cancelQueuedChangeQuestion: 'Diese vorgemerkte Änderung abbrechen?',
      cancelQueuedChangeDescription:
        'Dadurch wird die lokale Änderung aus der Warteschlange entfernt, bevor sie synchronisiert wird. Nutze dies nur, wenn die Änderung nicht an FlowPro gesendet werden soll.',
      keepQueuedChange: 'Vorgemerkte Änderung behalten',
      cancelQueuedChange: 'Vorgemerkte Änderung abbrechen',
      operationStatuses: {
        pending: 'Vorgemerkt',
        syncing: 'Wird synchronisiert',
        synced: 'Synchronisiert',
        failed: 'Wiederholung nötig',
        conflict: 'Konflikt',
        cancelled: 'Abgebrochen',
      },
      operationTitles: {
        clockEventCreate: 'Zeitbuchung wartet auf Synchronisierung',
        clockEventUpdate:
          'Aktualisierte Zeitbuchung wartet auf Synchronisierung',
        clockEventDelete: 'Gelöschte Zeitbuchung wartet auf Synchronisierung',
        requestSubmit: 'Antrag wartet auf Synchronisierung',
        requestApprove: 'Freigabeentscheidung wartet auf Synchronisierung',
        requestReject: 'Ablehnungsentscheidung wartet auf Synchronisierung',
        requestCancel: 'Antragsstornierung wartet auf Synchronisierung',
        timesheetSign: 'Zeiterfassungs-Signierung wartet auf Synchronisierung',
        timesheetExport: 'Exportnachweis wartet auf Synchronisierung',
        userInvite: 'Nutzereinladung wartet auf Synchronisierung',
        userUpdate: 'Nutzeränderung wartet auf Synchronisierung',
        userDeactivate: 'Nutzerdeaktivierung wartet auf Synchronisierung',
        userReactivate: 'Nutzerreaktivierung wartet auf Synchronisierung',
        default: '{{type}} wartet auf Synchronisierung',
      },
      operationDescriptions: {
        pending: 'Sicher auf diesem Gerät vorgemerkt.',
        syncing: 'FlowPro sendet diese Änderung gerade.',
        failed:
          'Synchronisierung fehlgeschlagen. Fehler prüfen und bei Bedarf wiederholen.',
        conflict:
          'Diese Änderung steht im Konflikt mit Serverdaten und benötigt eine Entscheidung.',
      },
      exportSuccess: 'Lokale FlowPro-Daten exportiert',
      exportError: 'Lokale FlowPro-Daten konnten nicht exportiert werden',
      importSuccess: 'Lokale FlowPro-Daten importiert',
      importError: 'Lokale FlowPro-Daten konnten nicht importiert werden',
      indexedDbUnavailable: 'IndexedDB ist in dieser Umgebung nicht verfügbar.',
      invalidLocalDataExport:
        'Diese Datei ist kein gültiger lokaler FlowPro-Export.',
      closeOtherTabsBeforeUpgrade:
        'Schließe andere FlowPro-Tabs, damit die lokalen Daten aktualisiert werden können.',
      closeOtherTabsBeforeReset:
        'Schließe andere FlowPro-Tabs, bevor du die lokalen Daten zurücksetzt.',
      migrationNotes: {
        organizationCatalogs: {
          title: 'Organisationskataloge',
          description:
            'Fügt lokale Stammdaten für Abteilungen, Standorte, Rollenprofile, Teams und Arbeitsmuster hinzu.',
        },
        managerDelegations: {
          title: 'Manager-Delegationen',
          description:
            'Fügt persistente Delegations- und Vertretungsregeln für Freigaben und Sichtbarkeit hinzu.',
        },
        attendancePolicyConfig: {
          title: 'Anwesenheitsrichtlinien',
          description:
            'Fügt einen lokalen Speicher für Firmenrichtlinien hinzu, der von Anträgen, Planung und Zeiterfassung genutzt wird.',
        },
      },
    },
    syncHealthUi: {
      title: 'Sync-Zustand',
      description:
        'Operative Sicht auf Local-first-Lesezugriffe, Projektions-Hydration und wartende Schreibvorgänge.',
      attentionRequired: 'Aufmerksamkeit nötig',
      projectionHydrationNeedsAttention:
        'Ein oder mehrere Projektionsfeeds benötigen Aufmerksamkeit.',
      onlineState: 'Online-Status',
      online: 'Online',
      offline: 'Offline',
      pendingOutbox: 'Ausstehende Outbox',
      lastSuccessfulSync: 'Letzte erfolgreiche Synchronisierung',
      serverCursor: 'Server-Cursor',
      projectionFeeds: 'Projektionsfeeds',
      projectionFeedsDescription:
        'Backend-sichere Projektionsfeeds, die für sofortige lokale Lesezugriffe in IndexedDB angewendet werden.',
      hydrateProjections: 'Projektionen hydratisieren',
      hydrationComplete: 'Projektions-Hydration abgeschlossen',
      hydrationCompletedWithErrors:
        'Projektions-Hydration mit Fehlern abgeschlossen',
      hydrationFailed: 'Projektions-Hydration fehlgeschlagen',
      module: 'Modul',
      items: 'Einträge',
      lastHydrated: 'Zuletzt hydratisiert',
      status: 'Status',
      healthy: 'Gesund',
      needsAttention: 'Aufmerksamkeit nötig',
      notHydrated: 'Nicht hydratisiert',
      never: 'Nie',
      localStoreCounts: 'Lokale Speicherstände',
      modules: {
        audit: 'Audit',
        requests: 'Anträge',
        absences: 'Abwesenheiten',
        notifications: 'Benachrichtigungen',
        timesheets: 'Timesheets',
        users: 'Benutzer',
        organizationCatalogs: 'Organisationskataloge',
        employmentContracts: 'Arbeitsverträge',
        planning: 'Planung',
        reports: 'Berichte',
      },
    },
    qualityHealthUi: {
      title: 'Qualitätszustand',
      description:
        'Operative Qualitätssicht auf Bug-SLA, Sync-Risiko, Audit-Integrität und lokale Nachweise.',
      attentionRequired: 'Aufmerksamkeit nötig',
      attentionRequiredDescription:
        'Ein oder mehrere operative Signale müssen geprüft werden, bevor Feature-Arbeit weitergeht.',
      qualityScore: 'Qualitätswert',
      qualityScoreDescription:
        'Abgeleitet aus Audit-, Sync-, Projektions- und Outbox-Zustand.',
      bugSla: 'Bug-SLA',
      bugSlaDescription:
        'FlowPro hält Bugs sichtbar und zeitlich begrenzt, statt einen stillen Rückstand aufzubauen.',
      bugDashboard: 'Bug-Dashboard',
      bugDashboardDescription:
        'Operative Bug-Sicht aus aktuellen Qualitätssignalen, bis ein Issue-Tracker angebunden ist.',
      openBugs: 'Offene Bugs',
      highSeverityBugs: 'Bugs mit hoher Schwere',
      normalSeverityBugs: 'Bugs mit normaler Schwere',
      oldestOpenBug: 'Ältester offener Bug',
      productAreas: 'Produktbereiche',
      highSeverity: 'Hohe Schwere',
      normalSeverity: 'Normale Schwere',
      hours: '{count} Stunden',
      days: '{count} Tage',
      openRisks: 'Offene Risiken',
      failedOutbox: 'Fehlgeschlagene Outbox',
      serverHealth: 'Server-Zustand',
      projectionFailures: 'Projektionsfehler',
      auditIntegrity: 'Audit-Integrität',
      valid: 'Gültig',
      review: 'Prüfen',
      operationalRisks: 'Operative Risiken',
      operationalRisksDescription:
        'Aktuelle Risiken, durch die Local-first-Daten veraltet, unvollständig oder rechtlich unsicher werden können.',
      noOperationalRisks: 'Keine operativen Risiken erkannt.',
      severity: 'Schwere',
      risk: 'Risiko',
      action: 'Aktion',
      critical: 'Kritisch',
      warning: 'Warnung',
      ok: 'OK',
      evidence: 'Nachweise',
      serverOperations: 'Serverbetrieb',
      serverOperationsDescription:
        'Backend-Signale der maßgeblichen Quelle für Projektionen, Audit und Outbox-Verarbeitung.',
      backendReachability: 'Backend-Erreichbarkeit',
      reachable: 'Erreichbar',
      unavailable: 'Nicht verfügbar',
      serverPendingOutbox: 'Wartende Server-Outbox',
      serverFailedOutbox: 'Fehlgeschlagene Server-Outbox',
      lastProcessedOutbox: 'Letzte verarbeitete Outbox',
      lastAuditEvent: 'Letztes Audit-Ereignis',
      lastProjectionUpdate: 'Letzte Projektionsaktualisierung',
      serverCursor: 'Server-Projektionsanzahl',
      lastServerError: 'Letzter Serverfehler',
      operationsHealthUnavailable:
        'Der Betriebszustand ist nicht verfügbar. Es werden nur lokale Qualitätssignale angezeigt.',
      lastSuccessfulSync: 'Letzte erfolgreiche Synchronisierung',
      lastSyncError: 'Letzter Sync-Fehler',
      localSchema: 'Lokales Schema',
      newestFailedOutbox: 'Neueste fehlgeschlagene Outbox',
      none: 'Keine',
      never: 'Nie',
      unknown: 'Unbekannt',
      issues: {
        auditIntegrity: {
          title: 'Audit-Kette muss geprüft werden',
          description:
            'Prüfe Audit-Nachweise, bevor Exporte oder Payroll-/Rechtsdaten verwendet werden.',
        },
        offline: {
          title: 'Client ist offline',
          description:
            'Prüfe die Verbindung, bevor rechtlich oder payroll-relevante Workflows freigegeben werden.',
        },
        failedOutbox: {
          title: 'Outbox enthält fehlgeschlagene Schreibvorgänge',
          description:
            'Wiederhole, löse oder storniere fehlgeschlagene Vorgänge, damit der Backend-Stand maßgeblich bleibt.',
        },
        pendingOutbox: {
          title: 'Outbox enthält wartende Schreibvorgänge',
          description:
            'Warte auf Sync oder prüfe die Warteschlange, bevor aktualisierte Projektionen vertraut werden.',
        },
        projectionErrors: {
          title: 'Projektions-Hydration fehlgeschlagen',
          description:
            'Hydratisiere Projektionen erneut und prüfe Modulfehler im Sync-Zustand.',
        },
        syncError: {
          title: 'Sync-Engine meldet einen Fehler',
          description:
            'Öffne den Sync-Zustand und behebe den Fehler, bevor neue Workflow-Änderungen ausgeliefert werden.',
        },
        serverHealthCritical: {
          title: 'Backend-Betrieb ist nicht gesund',
          description:
            'Behebe fehlgeschlagene Backend-Outbox-Verarbeitung, bevor Rechts- oder Payroll-Nachweisen vertraut wird.',
        },
        serverHealthWarning: {
          title: 'Backend-Betrieb muss geprüft werden',
          description:
            'Prüfe wartende Backend-Arbeit und bestätige, dass Projektionen aufholen, bevor Release-Arbeit weitergeht.',
        },
        serverHealthUnavailable: {
          title: 'Backend-Betriebszustand ist nicht verfügbar',
          description:
            'Prüfe die API-Erreichbarkeit, bevor dem Local-first-Dashboard allein vertraut wird.',
        },
      },
    },
    accessUi: {
      permissionMessages: {
        'manage-users':
          'Nur HR und Administratoren können Mitarbeiterzugänge verwalten.',
        'manage-policies':
          'Nur HR und Administratoren können Anwesenheitsrichtlinien ändern.',
        'view-audit':
          'Nur HR und Administratoren können vollständige Auditdetails sehen.',
        'team-detail':
          'Manager sehen operative Details für ihr Team. Teamkollegen sehen nur den Verfügbarkeitsstatus.',
      },
    },
    privacyUi: {
      retentionClockEvents:
        'Arbeitszeitdokumentation und Payroll-Verteidigung.',
      retentionRequests:
        'Verwaltung von Beschäftigung und Historie der Abwesenheitsplanung.',
      retentionAuditEvents:
        'Sicherheit, Nachvollziehbarkeit und Änderungsverfolgung.',
      retentionPayrollExports: 'Payroll- und Steuerdokumentation.',
      hiddenByPolicy: 'Durch Richtlinie verborgen',
      confidentialAbsence: 'Vertrauliche Abwesenheit',
      onlyHrAdminEmployeeCanViewSensitive:
        'Nur HR/Admin und der Mitarbeiter können diesen sensiblen Antrag sehen.',
      managerViewLimited:
        'Manageransicht ist auf operative Planungsdetails beschränkt. Gründe und Anhänge bleiben privat.',
      teammateViewLimited: 'Teamkollegen sehen nur den Verfügbarkeitsstatus.',
      timeCorrection: 'Zeitkorrektur',
      remote: 'Remote',
      unavailable: 'Nicht verfügbar',
    },
    usersValidation: {
      firstNameRequired: 'Vorname ist erforderlich.',
      lastNameRequired: 'Nachname ist erforderlich.',
      usernameRequired: 'Benutzername ist erforderlich.',
      phoneRequired: 'Telefonnummer ist erforderlich.',
      emailRequired: 'E-Mail ist erforderlich.',
      teamRequired: 'Team ist erforderlich.',
      managerRequired: 'Manager ist erforderlich.',
      workPatternRequired: 'Arbeitsmuster ist erforderlich.',
      visibilityRequired: 'Sichtbarkeitsbereich ist erforderlich.',
      roleRequired: 'Rolle ist erforderlich.',
      passwordRequired: 'Passwort ist erforderlich.',
      passwordLength: 'Passwort muss mindestens 8 Zeichen lang sein.',
      passwordLowercase:
        'Passwort muss mindestens einen Kleinbuchstaben enthalten.',
      passwordNumber: 'Passwort muss mindestens eine Zahl enthalten.',
      passwordMatch: 'Passwörter stimmen nicht überein.',
      inviteEmailRequired: 'Bitte E-Mail zum Einladen eingeben.',
    },
    settingsUi: {
      settings: 'Einstellungen',
      settingsDescription:
        'Identität, Kontoeinstellungen, Benachrichtigungen und Anwesenheitsrichtlinien konfigurieren.',
      profile: 'Profil',
      account: 'Konto',
      appearance: 'Darstellung',
      notifications: 'Benachrichtigungen',
      attendance: 'Anwesenheit',
      notificationsDescription:
        'Wählen, welche Anwesenheits-, Freigabe-, Sync- und Sicherheitsereignisse Sie benachrichtigen sollen.',
      notificationsUpdated: 'Benachrichtigungseinstellungen aktualisiert.',
      recentNotifications: 'Aktuelle Benachrichtigungen',
      recentNotificationsDescription:
        'Server-synchronisierte Hinweise zu Freigaben, Anträgen, Payroll und Sync.',
      unreadNotifications: '{{count}} ungelesen',
      allRead: 'Alle gelesen',
      markAllRead: 'Alle als gelesen markieren',
      loadingNotifications: 'Benachrichtigungen werden geladen...',
      noSyncedNotificationsYet:
        'Noch keine synchronisierten Benachrichtigungen.',
      recently: 'Kürzlich',
      markRead: 'Als gelesen markieren',
      requestDecisions: 'Antragsentscheidungen',
      requestDecisionsDescription:
        'Benachrichtige mich, wenn meine Urlaubs-, Homeoffice- oder Korrekturanträge genehmigt oder abgelehnt wurden.',
      approvalQueue: 'Freigabewarteschlange',
      approvalQueueDescription:
        'Benachrichtige Manager, wenn Teamanträge eine Entscheidung brauchen.',
      timesheetExceptions: 'Zeiterfassungs-Ausnahmen',
      timesheetExceptionsDescription:
        'Benachrichtige mich über fehlende Ausstempelungen, Pausenkonformität und unsignierte Perioden.',
      offlineSyncFailures: 'Offline-Sync-Fehler',
      offlineSyncFailuresDescription:
        'Benachrichtige mich, wenn Local-first-Vorgänge Aufmerksamkeit oder Wiederholung brauchen.',
      weeklyAttendanceSummary: 'Wöchentliche Anwesenheitszusammenfassung',
      weeklyAttendanceSummaryDescription:
        'Sende eine kurze wöchentliche Übersicht zu Arbeitsstunden, Flexsaldo und kommenden Abwesenheiten.',
      securityEmails: 'Sicherheits-E-Mails',
      securityEmailsDescription:
        'Sende immer Anmelde- und Kontosicherheitsereignisse.',
      updateNotifications: 'Benachrichtigungen aktualisieren',
      display: 'Anzeige',
      displayDescription:
        'Elemente ein- oder ausschalten, um zu steuern, was in der App angezeigt wird.',
      displayUpdated: 'Anzeigeeinstellungen aktualisiert.',
      selectAtLeastOneDisplayPreference:
        'Wählen Sie mindestens eine Anzeigeeinstellung aus.',
      workSurface: 'Arbeitsfläche',
      workSurfaceDescription:
        'Konfigurieren, wie viel operativen Kontext FlowPro rund um Kernworkflows zeigt.',
      updateDisplay: 'Anzeige aktualisieren',
      profileUpdated: 'Profil aktualisiert.',
      profileUpdateFailed:
        'Dein Profil konnte nicht aktualisiert werden. Bitte erneut versuchen.',
      preferencesSaveFailed:
        'Deine Einstellungen konnten nicht gespeichert werden. Bitte erneut versuchen.',
      firstNameRequired: 'Vorname ist erforderlich.',
      lastNameRequired: 'Nachname ist erforderlich.',
      usernameMinLength: 'Benutzername muss mindestens 2 Zeichen haben.',
      usernameMaxLength: 'Benutzername darf nicht länger als 40 Zeichen sein.',
      phoneNumberRequired: 'Telefonnummer ist erforderlich.',
      usernameDescription:
        'Wird für Audit-Beschriftungen, lokale Datensätze und generierte Mitarbeiterkennungen verwendet.',
      signInEmail: 'Anmelde-E-Mail',
      signInEmailDescription:
        'Die E-Mail gehört zur lokalen Anmeldeidentität. Ändern Sie sie unter People and access, wenn Backend-Auth verbunden ist.',
      phoneDescription:
        'Optionale operative Kontaktinformation für Manager und HR.',
      updateProfile: 'Profil aktualisieren',
      profileDescription:
        'Diese Informationen erscheinen in Anwesenheitsansichten, Freigaben, Teamplanung und Audit-Historie.',
      accountDescription:
        'Prüfen Sie Ihre angemeldete Identität und pflegen Sie lokale Kontoeinstellungen.',
      security: 'Sicherheit',
      securityDescription:
        'Verwalten Sie Ihre E-Mail-Adresse, Ihr Passwort und die angemeldeten Geräte.',
      emailAddress: 'E-Mail-Adresse',
      emailConfirmed: 'Bestätigt',
      emailNotConfirmed: 'Nicht bestätigt',
      resendConfirmation: 'Bestätigungs-E-Mail senden',
      confirmationSent:
        'Wir haben einen Bestätigungslink an {{email}} gesendet.',
      changeEmail: 'E-Mail-Adresse ändern',
      changeEmailDescription:
        'Wir senden einen Link an die neue Adresse. Ihre Adresse ändert sich, sobald Sie ihn öffnen; bis dahin melden Sie sich weiter mit der aktuellen an.',
      newEmail: 'Neue E-Mail-Adresse',
      emailChangeSent:
        'Sehen Sie in {{email}} nach und öffnen Sie den Link, um die Änderung abzuschließen.',
      changePassword: 'Passwort ändern',
      changePasswordDescription:
        'Eine Passwortänderung meldet alle anderen Geräte ab. Hier bleiben Sie angemeldet.',
      currentPassword: 'Aktuelles Passwort',
      passwordChanged:
        'Passwort geändert. Abgemeldete andere Sitzungen: {{count}}.',
      sessions: 'Angemeldete Geräte',
      sessionsDescription:
        'Beenden Sie jede Sitzung, die Sie nicht kennen, und ändern Sie dann Ihr Passwort.',
      signOutOtherSessions: 'Überall sonst abmelden',
      otherSessionsEnded: 'Abgemeldete andere Sitzungen: {{count}}.',
      endSession: 'Abmelden',
      sessionEnded: 'Das Gerät wurde abgemeldet.',
      thisDevice: 'Dieses Gerät',
      deviceName: '{{browser}} unter {{os}}',
      unknownDevice: 'Unbekanntes Gerät',
      sessionDetails:
        'Angemeldet {{signedIn}} · zuletzt aktiv {{lastSeen}} · IP {{ip}}',
      appearanceDescription:
        'Design und Typografie für komfortable tägliche Anwesenheitsarbeit anpassen.',
      appearanceUpdated: 'Darstellungseinstellungen aktualisiert.',
      font: 'Schriftart',
      fontDescription:
        'Legt die Schriftart fest, die in FlowPro-Arbeitsflächen verwendet wird.',
      theme: 'Design',
      themeDescription: 'Wählen Sie das Design für FlowPro.',
      light: 'Hell',
      dark: 'Dunkel',
      updatePreferences: 'Einstellungen aktualisieren',
      displayItems: {
        'density-compact': {
          label: 'Kompakte operative Dichte',
          description:
            'Engere Zeilen in Tabellen und Planungsflächen verwenden.',
        },
        'show-sync': {
          label: 'Sync-Status anzeigen',
          description:
            'Local-first-Sync-Status in der Kopfzeile sichtbar halten.',
        },
        'show-policy-hints': {
          label: 'Berechtigungs- und Richtlinienhinweise anzeigen',
          description:
            'Erklärt, warum Felder ausgeblendet, deaktiviert oder maskiert sind.',
        },
        'full-width-pages': {
          label: 'Arbeitsseiten in voller Breite verwenden',
          description:
            'Breite Layouts für Berichte, Planung und Zeiterfassung bevorzugen.',
        },
      },
    },
    settings: {
      account: {
        signedInAs: 'Angemeldet als',
        role: 'Rolle',
        team: 'Team',
        manager: 'Vorgesetzter',
        workPattern: 'Arbeitsmuster',
        selectLanguage: 'Sprache wählen',
        timesShownIn: 'Zeiten angezeigt in',
        selectTimezone: 'Zeitzone wählen',
        searchTimezone: 'Zeitzonen suchen...',
        weekStartsOn: 'Woche beginnt am',
        defaultWorkLocation: 'Standard-Arbeitsort',
        updateAccount: 'Konto aktualisieren',
        updated: 'Kontoeinstellungen aktualisiert.',
        languageDescription:
          'Wird für lokalisierte Labels, E-Mails und Exporte genutzt.',
        timezoneDescription:
          'Wird für Buchungen, Antragsdaten und Audit-Zeitstempel genutzt.',
      },
    },
  },
}
