'use strict'

const {Gio, GObject} = imports.gi;
const PopupMenu = imports.ui.popupMenu;
const QuickSettings = imports.ui.quickSettings;

// This is the live instance of the Quick Settings menu
const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;


const AutomaticSuspendToggle = GObject.registerClass(
class AutomaticSuspendToggle extends QuickSettings.QuickMenuToggle {
    _init() {
        super._init({
            toggleMode: true,
        });
        
        // NOTE: In GNOME 44, the `label` property must be set after
        // construction. The newer `title` property can be set at construction.
        this.label = _('Auto Suspend');

        this._batterySuspendSwitch = new PopupMenu.PopupSwitchMenuItem(
            'When on battery power',
            false,
            {}
        );
        this._batterySuspendSwitch.connect('toggled', (item, state) => {
            const val = state ? 'suspend' : 'nothing';
            this._settings.set_string('sleep-inactive-battery-type', val);
            this._savedBatterySuspendType = val;
        });

        this._acSuspendSwitch = new PopupMenu.PopupSwitchMenuItem(
            'When plugged in',
            false,
            {}
        );
        this._acSuspendSwitch.connect('toggled', (item, state) => {
            const val = state ? 'suspend' : 'nothing';
            this._settings.set_string('sleep-inactive-ac-type', val);
            this._savedACSuspendType = val;
        });

        // Build menu top to bottom
        this.menu.setHeader(null, 'Automatic Suspend', 'quickly toggle between AC and battery states');
        this.menu.addMenuItem(this._batterySuspendSwitch);
        this.menu.addMenuItem(this._acSuspendSwitch);

        // Add an entry-point for more settings
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addSettingsAction(_('Power settings'),
            'gnome-power-panel.desktop');

        // Binding the toggle to a GSettings key
        this._settings = new Gio.Settings({
            schema_id: 'org.gnome.settings-daemon.plugins.power',
        });

        this._settings.connect('changed::sleep-inactive-battery-type',
            () => this._sync()
        );
        this._settings.connect('changed::sleep-inactive-ac-type',
            () => this._sync()
        );

        this.connect('destroy', () => this._settings.run_dispose());
        this.connect('clicked', () => this._shutter());

        // In the edge case that the first sync() below finds both settings to be 'nothing', preset the opposites.
        this._savedBatterySuspendType = 'suspend';
        this._savedACSuspendType = 'suspend';

        this._skipOneSync = false;

        this._sync();
    }

    // If button has been checked, saved values are restored. Else, activate shutter.
    _shutter() {
        // Because sync() is run async, we need to skip the first of the two calls when the system detects both to be changed.
        this._skipOneSync = this._savedBatterySuspendType === 'suspend' && this._savedACSuspendType === 'suspend';

        this._settings.set_string('sleep-inactive-battery-type',
            this.checked ? this._savedBatterySuspendType : 'nothing'
        );
        this._settings.set_string('sleep-inactive-ac-type',
            this.checked ? this._savedACSuspendType : 'nothing'
        );
    }

    _sync() {
        if (this._skipOneSync) {
            this._skipOneSync = false;
            return;
        }

        const batterySuspendType = this._settings.get_string('sleep-inactive-battery-type');
        const acSuspendType = this._settings.get_string('sleep-inactive-ac-type');

        const batterySuspendActive = batterySuspendType === 'suspend';
        const acSuspendActive = acSuspendType === 'suspend';

        this._batterySuspendSwitch.setToggleState(batterySuspendActive);
        this._acSuspendSwitch.setToggleState(acSuspendActive);

        this.checked = batterySuspendActive || acSuspendActive;

        if (this.checked) {
            this._savedBatterySuspendType = batterySuspendType;
            this._savedACSuspendType = acSuspendType;
        }

        // TODO: figure how to achieve this stuff below. Currently, it does nothing.
        if (batterySuspendActive && acSuspendActive)
            this._label = _('Auto Suspend');
        else if (batterySuspendActive)
            this._label = _('On Battery');
        else if (acSuspendActive)
            this._label = _('Plugged In');
        else
            this._label = _('No Auto Suspend');
    }
});


const AutomaticSuspendIndicator = GObject.registerClass(
class AutomaticSuspendIndicator extends QuickSettings.SystemIndicator {
    _init() {
        super._init();

        // Create the indicator
        this._indicator = this._addIndicator();

        // Create the toggle and associate it with the indicator, being sure to
        // destroy it along with the indicator
        this.quickSettingsItems.push(new AutomaticSuspendToggle());
        
        this.connect('destroy', () => {
            this.quickSettingsItems.forEach(item => item.destroy());
        });
        
        // Add the indicator to the panel and the toggle to the menu
        QuickSettingsMenu._indicators.add_child(this);
        QuickSettingsMenu._addItems(this.quickSettingsItems);
    }
});


class Extension {
    constructor() {
        this._indicator = null;
    }
    
    enable() {
        this._indicator = new AutomaticSuspendIndicator();
    }
    
    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init() {
    return new Extension();
}
