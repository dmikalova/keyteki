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
                "Wild Wormhole's bonus icon has player1 gain 1 amber",
                'player1 uses Wild Wormhole to play Eureka!',
                'player1 is unable to play Eureka! and returns it to deck'
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
                'player1 is unable to play Mimic Gel as Bumblebird and returns it to hand'
            ]);
        });
    });
});
