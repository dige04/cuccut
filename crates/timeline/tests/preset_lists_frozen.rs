//! The preset enums of Timeline 0.1 are a **production contract** (design §10, phase 2). The canonical families added in phase 2 are open only to BCF. They must not leak into the two closed enums in `timeline.json`, nor into the Mac / GPUI animation panel catalog (`exposedTo` and `available` each handle one half of that).

use motion::preset_registry::{Domain, Surface, ids, manifest, manifest_ids};
use timeline::schema::{
    ENTER_PRESETS, EXIT_LEGACY_PRESETS, EXIT_PRESETS, LOOP_PRESETS, exit_preset_accepted,
};

#[test]
fn timeline_enums_stay_at_fifty_three_forty_nine_and_twenty() {
    // 2026-08-30: +compress/bounce/fall/skid/roll (aligned the text animation catalog).
    // 2026-09-05 (round 156): +slideUp/slideDown/wave/flipboard/dragonfly/
    // billboard; loop +rotate/heartBeat/vogue/dragonfly/billboard/roll.
    // 2026-09-08: +28/+28/+9 element catalog (`el*`, `surface: "element"`);
    // the text catalog is still 25/21/11.
    assert_eq!(ENTER_PRESETS.len(), 53);
    assert_eq!(EXIT_PRESETS.len(), 49);
    assert_eq!(LOOP_PRESETS.len(), 20);
    assert_eq!(
        ENTER_PRESETS
            .iter()
            .filter(|id| !id.starts_with("el"))
            .count(),
        25
    );
    assert_eq!(
        EXIT_PRESETS
            .iter()
            .filter(|id| !id.starts_with("el"))
            .count(),
        21
    );
    assert_eq!(
        LOOP_PRESETS
            .iter()
            .filter(|id| !id.starts_with("el"))
            .count(),
        11
    );
}

/// The three closed document sets must equal the three timeline recipe tables of `ccut-motion` **entry by entry, in order**.
/// The panel catalog, document validation and engine lookup may have only one source of truth (round 156: the root cause of the `sink` save failure was the exit slot borrowing the enter-preset list for validation). 0.1-compatible names are accepted on read only and are not in the recipe tables.
#[test]
fn timeline_enums_equal_the_recipe_tables_in_order() {
    use motion::preset_registry::timeline_exit;

    assert_eq!(ids(Domain::TimelineEnter), ENTER_PRESETS);
    assert_eq!(ids(Domain::TimelineExit), EXIT_PRESETS);
    assert_eq!(ids(Domain::TimelineLoop), LOOP_PRESETS);
    for id in EXIT_PRESETS {
        assert!(exit_preset_accepted(id));
    }
    for id in EXIT_LEGACY_PRESETS {
        assert!(
            timeline_exit(id).is_none(),
            "{id} has a recipe, so it should be in EXIT_PRESETS"
        );
        assert!(
            ENTER_PRESETS.contains(id),
            "{id} can only be left over from borrowing the enter preset list"
        );
        assert!(exit_preset_accepted(id));
    }
    assert!(!exit_preset_accepted("wave"));
}

#[test]
fn no_canonical_family_leaks_into_the_timeline_enums() {
    for id in manifest_ids() {
        assert!(!ENTER_PRESETS.contains(&id), "{id}");
        assert!(!EXIT_PRESETS.contains(&id), "{id}");
        assert!(!LOOP_PRESETS.contains(&id), "{id}");
        let entry = manifest(id).unwrap();
        assert!(
            !entry.exposed_to.contains(&Surface::Timeline),
            "{id} declares the timeline surface"
        );
        assert!(
            !entry.exposed_to.contains(&Surface::MacStage),
            "{id} declares the macStage surface (ADR-M09: Mac catalogue is frozen)"
        );
    }
}

/// BCF's alias table and Timeline's three tables are **two separate namespaces**: `rise` and `pulse` exist on both sides with different meanings, by design (plan §2.4.3). What must hold is that the lookup entry points do not cross: Timeline only goes through `timeline_enter/exit/loop` and never passes through `canonical_id`.
#[test]
fn timeline_lookups_never_go_through_the_bcf_alias_table() {
    use motion::preset_registry::{canonical_id, timeline_enter, timeline_loop};

    for name in ENTER_PRESETS {
        assert!(timeline_enter(name).is_some(), "{name}");
    }
    assert_eq!(canonical_id("rise"), "motion.moveIn");
    assert_eq!(timeline_enter("rise").unwrap().id, "rise");
    assert_eq!(canonical_id("pulse"), "motion.pulse");
    assert_eq!(timeline_loop("pulse").unwrap().id, "pulse");
}
