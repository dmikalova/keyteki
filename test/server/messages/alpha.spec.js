describe('Alpha Messages', function () {
    describe('alpha restriction from Wild Wormhole', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['wild-wormhole'],
                    discard: ['eureka']
                },
                player2: {
                    inPlay: ['troll']
                }
            });
        });

        it('should log correct message when alpha card cannot be played', function () {
            this.player1.moveCard(this.eureka, 'deck');
            this.player1.play(this.wildWormhole);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Wild Wormhole',
                "Wild Wormhole's amber bonus icon has player1 gain 1 amber",
                "Wild Wormhole's play ability plays Eureka! from the top of player1's deck",
                "player1 cannot play Eureka! and returns it to the top of player1's deck"
            ]);
        });
    });

    describe('alpha restriction from Mimic Gel copying an alpha creature', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    inPlay: ['batdrone'],
                    hand: ['mimic-gel']
                },
                player2: {
                    inPlay: ['bumblebird', 'troll']
                }
            });
        });

        it('should log correct messages when Mimic Gel copy is alpha-restricted', function () {
            this.player1.reap(this.batdrone);
            this.player1.playCreature(this.mimicGel);
            this.player1.clickCard(this.bumblebird);
            expect(this.mimicGel.location).toBe('hand');
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 reaps with Batdrone to gain 1 amber',
                'player1 plays Mimic Gel',
                'Mimic Gel enters play as a copy of Bumblebird',
                "Mimic Gel as Bumblebird's constant ability changes Mimic Gel as Bumblebird's house to logos",
                "player1 cannot play Mimic Gel as Bumblebird and returns it to player1's hand"
            ]);
        });
    });

    describe('alpha restriction from Murkens playing off opponent deck', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'shadows',
                    hand: ['murkens']
                },
                player2: {
                    discard: ['eureka']
                }
            });
        });

        it('should log correct message when Murkens fails to play alpha card from opponent deck', function () {
            this.player2.moveCard(this.eureka, 'deck');
            this.player1.play(this.murkens);
            this.player1.clickPrompt('Top of deck');
            expect(this.eureka.location).toBe('deck');
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Murkens',
                "player1 chooses option 'Top of deck'",
                "Murkens's play ability plays Eureka! from the top of player2's deck",
                "player1 cannot play Eureka! and returns it to the top of player2's deck"
            ]);
        });
    });

    describe('alpha restriction from Mimicry copying alpha action as second play', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'untamed',
                    hand: ['mimicry', 'dust-pixie']
                },
                player2: {
                    discard: ['eureka']
                }
            });
        });

        it('should log cannot play when Mimicry copies alpha card as second play', function () {
            this.player1.play(this.dustPixie);
            this.player1.play(this.mimicry);
            this.player1.clickCard(this.eureka);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Dust Pixie',
                "Dust Pixie's amber bonus icon has player1 gain 1 amber",
                "Dust Pixie's amber bonus icon has player1 gain 1 amber",
                'player1 uses Mimicry to apply a lasting effect to Mimicry',
                'player1 plays Mimicry as Eureka!',
                "player1 cannot play Mimicry and returns it to player1's hand"
            ]);
        });
    });
});
