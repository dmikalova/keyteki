describe('Cards-under-cards (manual mode)', function () {
    describe('placeFaceup / placeFacedown menu commands', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    inPlay: ['niffle-ape'],
                    hand: ['titan-mechanic', 'lamindra']
                },
                player2: {}
            });

            this.game.manualMode = true;
        });

        it("exposes 'Modify cards under' submenu and place options", function () {
            const menu = this.niffleApe.getMenu();
            const commands = menu.map((item) => item.command);
            expect(commands).toContain('under');
            expect(commands).toContain('placeFaceup');
            expect(commands).toContain('placeFacedown');
            // Place items live inside the 'under' submenu, not 'main'.
            const placeFaceup = menu.find((item) => item.command === 'placeFaceup');
            expect(placeFaceup.menu).toBe('under');
        });

        it('places a card from hand faceup under an in-play card', function () {
            this.player1.menuClick(this.niffleApe, {
                command: 'placeFaceup',
                menu: 'under'
            });
            expect(this.player1).toHavePrompt(this.niffleApe.name);
            this.player1.clickCard(this.titanMechanic);
            expect(this.player1).isReadyToTakeAction();
            expect(this.titanMechanic.parent).toBe(this.niffleApe);
            expect(this.titanMechanic.facedown).toBe(false);
            expect(this.niffleApe.childCards).toContain(this.titanMechanic);
            expect(this.player1.hand).not.toContain(this.titanMechanic);
        });

        it('places a card from hand facedown under an in-play card', function () {
            this.player1.menuClick(this.niffleApe, {
                command: 'placeFacedown',
                menu: 'under'
            });
            this.player1.clickCard(this.titanMechanic);
            expect(this.player1).isReadyToTakeAction();
            expect(this.titanMechanic.parent).toBe(this.niffleApe);
            expect(this.titanMechanic.facedown).toBe(true);
            expect(this.niffleApe.childCards).toContain(this.titanMechanic);
        });

        it('only allows selecting cards from the choosing player\u2019s hand', function () {
            // Sanity-check that the prompt rejects out-of-hand cards by
            // confirming the same card from the discard pile is not
            // accepted as a target.
            this.player1.moveCard(this.lamindra, 'discard');
            this.player1.menuClick(this.niffleApe, {
                command: 'placeFaceup',
                menu: 'under'
            });
            this.player1.clickCard(this.lamindra);
            expect(this.lamindra.parent).toBeNull();
            expect(this.lamindra.location).toBe('discard');
        });

        it('does nothing outside manual mode', function () {
            this.game.manualMode = false;
            this.player1.menuClick(this.niffleApe, {
                command: 'placeFaceup',
                menu: 'under'
            });
            expect(this.titanMechanic.parent).toBeNull();
            expect(this.niffleApe.childCards.length).toBe(0);
        });
    });

    describe('takeChild menu command', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'brobnar',
                    inPlay: ['memolith'],
                    hand: ['pound']
                },
                player2: {}
            });

            // Use the real graft path so the parent/childCards relationship
            // is established by the engine, not by hand.
            this.player1.useAction(this.memolith);
            this.player1.clickCard(this.pound);
            expect(this.pound.parent).toBe(this.memolith);
            expect(this.pound.location).toBe('grafted');

            this.game.manualMode = true;
        });

        it('exposes a takeChild entry per card currently underneath', function () {
            const takeEntries = this.memolith
                .getMenu()
                .filter((item) => item.command === 'takeChild');
            expect(takeEntries.length).toBe(1);
            expect(takeEntries[0].arg).toBe(this.pound.uuid);
            expect(takeEntries[0].text).toContain(this.pound.name);
            expect(takeEntries[0].menu).toBe('under');
        });

        it("returns the chosen child to its owner's hand", function () {
            this.player1.menuClick(this.memolith, {
                command: 'takeChild',
                arg: this.pound.uuid,
                menu: 'under'
            });
            expect(this.player1).isReadyToTakeAction();
            expect(this.pound.location).toBe('hand');
            expect(this.pound.parent).toBeNull();
            expect(this.memolith.childCards).not.toContain(this.pound);
        });

        it('labels facedown children by name in the menu', function () {
            // Players can see facedown cards they placed themselves, so
            // the menu still shows the name for usability. Only the
            // chat log hides it (covered by message tests).
            this.pound.facedown = true;
            const entry = this.memolith.getMenu().find((item) => item.command === 'takeChild');
            expect(entry.text).toBe('Take ' + this.pound.name);
        });

        it('does nothing outside manual mode', function () {
            this.game.manualMode = false;
            this.player1.menuClick(this.memolith, {
                command: 'takeChild',
                arg: this.pound.uuid,
                menu: 'under'
            });
            expect(this.pound.location).toBe('grafted');
            expect(this.pound.parent).toBe(this.memolith);
        });
    });

    describe('returnToHand menu command on upgrades', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'staralliance',
                    inPlay: ['com-officer-kirby'],
                    hand: ['kirby-s-blaster']
                },
                player2: {}
            });

            this.player1.playUpgrade(this.kirbySBlaster, this.comOfficerKirby);
            expect(this.comOfficerKirby.upgrades).toContain(this.kirbySBlaster);

            this.game.manualMode = true;
        });

        it('shows only Return to hand on the upgrade menu', function () {
            // Upgrades shouldn't expose exhaust/tokens/place-under options;
            // those don't make sense on an attachment.
            const upgradeCommands = this.kirbySBlaster.getMenu().map((item) => item.command);
            expect(upgradeCommands).toEqual(['returnToHand']);

            // The host creature (which has no parent) should NOT show this
            // option - it's strictly an "I am attached to something" action.
            const hostCommands = this.comOfficerKirby.getMenu().map((item) => item.command);
            expect(hostCommands).not.toContain('returnToHand');
            // ...but the host still has the standard manual-mode menu.
            expect(hostCommands).toContain('exhaust');
            expect(hostCommands).toContain('under');
        });

        it("returns the upgrade to its owner's hand and detaches it", function () {
            this.player1.menuClick(this.kirbySBlaster, {
                command: 'returnToHand',
                menu: 'main'
            });
            expect(this.player1).isReadyToTakeAction();
            expect(this.kirbySBlaster.location).toBe('hand');
            expect(this.kirbySBlaster.parent).toBeNull();
            expect(this.comOfficerKirby.upgrades).not.toContain(this.kirbySBlaster);
        });

        it('does nothing outside manual mode', function () {
            this.game.manualMode = false;
            this.player1.menuClick(this.kirbySBlaster, {
                command: 'returnToHand',
                menu: 'main'
            });
            expect(this.kirbySBlaster.location).toBe('play area');
            expect(this.kirbySBlaster.parent).toBe(this.comOfficerKirby);
        });
    });

    describe('upgrades vs childCards', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'staralliance',
                    inPlay: ['com-officer-kirby'],
                    hand: ['kirby-s-blaster', 'titan-mechanic']
                },
                player2: {}
            });

            this.player1.playUpgrade(this.kirbySBlaster, this.comOfficerKirby);
            this.game.manualMode = true;
        });

        it('keeps upgrades and childCards in distinct arrays', function () {
            // Place a card under the same creature via the new manual-mode
            // menu. Upgrades must stay on .upgrades and the placed card
            // must land on .childCards - never both.
            this.player1.menuClick(this.comOfficerKirby, {
                command: 'placeFaceup',
                menu: 'under'
            });
            this.player1.clickCard(this.titanMechanic);
            expect(this.player1).isReadyToTakeAction();

            expect(this.titanMechanic.parent).toBe(this.comOfficerKirby);
            expect(this.comOfficerKirby.childCards).toEqual([this.titanMechanic]);

            // The pre-existing upgrade lives on .upgrades, NOT .childCards.
            // A hypothetical "move all cards under X to Y" ability that
            // iterates childCards would correctly leave the upgrade behind.
            expect(this.comOfficerKirby.upgrades).toEqual([this.kirbySBlaster]);
            expect(this.comOfficerKirby.childCards).not.toContain(this.kirbySBlaster);
            expect(this.comOfficerKirby.upgrades).not.toContain(this.titanMechanic);

            const overlap = this.comOfficerKirby.upgrades.filter((u) =>
                this.comOfficerKirby.childCards.includes(u)
            );
            expect(overlap).toEqual([]);
        });
    });

    describe('placing under enemy cards', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['titan-mechanic']
                },
                player2: {
                    inPlay: ['niffle-ape']
                }
            });

            this.game.manualMode = true;
        });

        it('lets a player place a card under an opponent-controlled creature', function () {
            // The active player should still see the place options on
            // an enemy creature - manual mode is a referee tool.
            const enemyCommands = this.niffleApe.getMenu(this.player1.player).map((i) => i.command);
            expect(enemyCommands).toContain('placeFaceup');
            expect(enemyCommands).toContain('placeFacedown');

            this.player1.menuClick(this.niffleApe, {
                command: 'placeFaceup',
                menu: 'under'
            });
            this.player1.clickCard(this.titanMechanic);
            expect(this.player1).isReadyToTakeAction();
            expect(this.titanMechanic.parent).toBe(this.niffleApe);
            expect(this.niffleApe.childCards).toContain(this.titanMechanic);
        });

        it("hides takeChild entries on an opponent's card and rejects the command", function () {
            // Seed a card under the enemy creature so there's something
            // to (try to) take.
            this.player1.menuClick(this.niffleApe, {
                command: 'placeFaceup',
                menu: 'under'
            });
            this.player1.clickCard(this.titanMechanic);
            expect(this.titanMechanic.parent).toBe(this.niffleApe);

            // From player1's perspective, the menu on the enemy card
            // must NOT list the take entries - players can't see what's
            // stashed under cards they don't control.
            const enemyMenu = this.niffleApe.getMenu(this.player1.player);
            expect(enemyMenu.find((i) => i.command === 'takeChild')).toBeUndefined();
            // Player2 (the controller) still sees the take entry.
            const ownerMenu = this.niffleApe.getMenu(this.player2.player);
            expect(ownerMenu.find((i) => i.command === 'takeChild')).toBeDefined();

            // Even if the client somehow issues the takeChild command
            // against an enemy card, the server refuses.
            this.player1.menuClick(this.niffleApe, {
                command: 'takeChild',
                arg: this.titanMechanic.uuid,
                menu: 'under'
            });
            expect(this.titanMechanic.parent).toBe(this.niffleApe);
            expect(this.titanMechanic.location).toBe('under');
        });

        it("returns a taken card to its owner's hand even when the host is enemy-controlled", function () {
            // player1 places their own Titan Mechanic under player2's
            // Niffle Ape; player2 (the host's controller) then takes
            // it back. The card belongs to player1, so it must land
            // in player1's hand - not player2's.
            this.player1.menuClick(this.niffleApe, {
                command: 'placeFaceup',
                menu: 'under'
            });
            this.player1.clickCard(this.titanMechanic);
            expect(this.titanMechanic.parent).toBe(this.niffleApe);
            expect(this.titanMechanic.owner).toBe(this.player1.player);

            this.player2.menuClick(this.niffleApe, {
                command: 'takeChild',
                arg: this.titanMechanic.uuid,
                menu: 'under'
            });
            expect(this.titanMechanic.location).toBe('hand');
            expect(this.titanMechanic.parent).toBeNull();
            expect(this.player1.hand).toContain(this.titanMechanic);
            expect(this.player2.hand).not.toContain(this.titanMechanic);
        });
    });
});
