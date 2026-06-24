describe('Control Messages', function () {
    describe('take control', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'shadows',
                    hand: ['sneklifter']
                },
                player2: {
                    inPlay: ['the-golden-spiral']
                }
            });
        });

        it('should log correct message when taking control of artifact', function () {
            this.player1.play(this.sneklifter);
            this.player1.clickCard(this.theGoldenSpiral);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Sneklifter',
                "Sneklifter's play ability has player1 take control of The Golden Spiral",
                "Sneklifter's play ability changes The Golden Spiral's house to shadows"
            ]);
        });
    });

    describe('take control until leaves play', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['harland-mindlock']
                },
                player2: {
                    inPlay: ['troll', 'bumpsy']
                }
            });
        });

        it('should log correct message when taking control until source leaves play', function () {
            this.player1.playCreature(this.harlandMindlock);
            this.player1.clickCard(this.troll);
            this.player1.clickPrompt('Left');
            this.harlandMindlock.exhausted = false;
            this.player1.fightWith(this.harlandMindlock, this.bumpsy);
            this.player1.clickPrompt('Left');
            expect(this.harlandMindlock.location).toBe('discard');
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Harland Mindlock',
                "Harland Mindlock's play ability has player1 take control of Troll",
                'player1 uses Harland Mindlock to make Harland Mindlock fight Bumpsy',
                'Harland Mindlock is destroyed'
            ]);
        });
    });

    describe('give control', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'saurian',
                    hand: ['exile'],
                    inPlay: ['senator-shrix']
                },
                player2: {}
            });
        });

        it('should log correct message when giving control of creature', function () {
            this.player1.play(this.exile);
            this.player1.clickCard(this.senatorShrix);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Exile',
                "Exile's amber bonus icon has player1 gain 1 amber",
                "Exile's play ability gives control of Senator Shrix to player2"
            ]);
        });
    });
});
