App = {
    web3Provider: null,
    web3: null,
    contracts: {},
    images: [
        "images/scottish-terrier.jpeg",
        "images/french-bulldog.jpeg",
        "images/boxer.jpeg",
        "images/golden-retriever.jpeg"
    ],
    network: "4447",

    initWeb3: function() {
        // Is there an injected web3 instance?
        if (typeof web3 !== 'undefined') {
            App.web3Provider = web3.currentProvider;
            $("#noWeb3").hide();
        } else {
            $("#noWeb3").show();
        }

        App.web3 = new Web3(App.web3Provider);
        App.checkNetwork(App.network);
        App.initContract();
    },

    netsMap: {'0': 'Olympic', '1': 'Frontier', '2': 'Morden', '3': 'Ropsten', '4': 'Rinkeby',
              '8': 'Ubiq', '42': 'Kovan', '77': 'Sokol', '99': 'Core', '7762959': 'Musicoin'},
    checkNetwork: function(requiredNetId) {
        web3.version.getNetwork((err, netId) => {
            console.log(netId);
            if (netId != requiredNetId) {
                let netName;
                if (requiredNetId in App.netsMap) {
                    netName = App.netsMap[requiredNetId];
                } else {
                    netName = '#' + requiredNetId;
                }

                $("#requiredNetwork").html(netName);
                $("#wrongNetwork").show();
            } else {
                $("#wrongNetwork").hide();
            }
        })
    },

    initContract: function() {
        $.getJSON('Adoption.json', function(data) {
            // Get the necessary contract artifact file and instantiate it with truffle-contract
            let AdoptionArtifact = data;
            App.contracts.Adoption = TruffleContract(AdoptionArtifact);

            // Set the provider for our contract
            App.contracts.Adoption.setProvider(App.web3Provider);

            // Show/hide owner elements
            // No need to check more than once (owner is not going to change!)
            App.checkOwner();

            // Watch pet shop events
            App.watchAdopted();
            App.watchAdded();

            // Use our contract to retrieve and mark the adopted pets
            return App.loadPets();
        });

        return App.bindEvents();
    },

    bindEvents: function() {
        console.log('bindEvents');
        $(document).on('click', '#add-pet', App.addPet);
        $(document).on('click', '.btn-adopt', App.adopt);
        $(document).on('click', '.btn-approve-pet', (event) => App.concreteAdoption(event, true));
        $(document).on('click', '.btn-reject-pet', (event) => App.concreteAdoption(event, false));
    },

    checkOwner: function() {
        App.web3.eth.getAccounts(function(error, accounts) {
            if (error) {
                console.log(error);
            }

            let account = accounts[0];
            App.contracts.Adoption.deployed().then(function(instance) {
                return instance.owner();
            }).then(function(owner) {
                if (owner == account) {
                    $(".onlyOwner").show();
                } else {
                    $(".onlyOwner").hide();
                }
            }).catch(function(err) {
                console.log(err.message);
            });
        });
    },

    watchAdopted: function() {
        let stateLabels = {1: ['info', 'Requested'], 2: ['success', 'Adopted'], 3: ['alert', 'Rejected']};

        App.contracts.Adoption.deployed().then(function(instance) {
            let UpdatedPetStateEvent = instance.UpdatedPetState({}, {fromBlock: 0, toBlock: 'latest'});
            UpdatedPetStateEvent.watch(function(err, result){
                args = result.args;
                console.log('Event[UpdatedPetState]', args);

                id = args.id;
                adopter = args.adopter;
                name = web3.toAscii(args.name);
                donation = web3.fromWei(args.donation.toNumber());
                state = args.state.toNumber();
                stateText = stateLabels[state];

                $('#adoptionLogTable > tbody:last-child').prepend(
                    '<tr><td>' + id + '</td><td>' + name + '</td><td><a href="#">' + adopter +'</a></td><td>' + donation + ' ETH</td><td><span class="badge badge-' + stateText[0] + '">' + stateText[1] + '</span></td></tr>'
                )

                App.loadPets();
            });
        });
    },

    watchAdded: function() {
        App.contracts.Adoption.deployed().then(function(instance) {
            let AddedPetEvent = instance.AddedPet({}, {fromBlock: 0, toBlock: 'latest'});
            AddedPetEvent.watch(function(error, result){
                args = result.args;
                console.log('Event[AddedPet]', args);

                App.loadPets();
            });
        });
    },

    concreteAdoption: function(event, approved) {
        event.preventDefault();
        console.log('concreteAdoption', approved);

        let petId = parseInt($(event.target).data('id'));
        App.contracts.Adoption.deployed().then(function(instance) {
            return instance.concreteAdoption(petId, approved);
        })
    },

    loadPets: function() {
        console.log('loadPets');
        let adoptionInstance;
        App.contracts.Adoption.deployed().then(function(instance) {
            adoptionInstance = instance;
            return adoptionInstance.getNumberOfPets.call();
        }).then(function(res) {
            let numberOfPets = res.toNumber(); // number of pets is a BigNumber

            if (numberOfPets > 0) {
                $('.btn-addPet').show();
                $("#noPets").hide();

                let promises = [];

                for(i = 0; i < numberOfPets; i++) {
                    promises.push(adoptionInstance.getPet.call(i))
                }

                Promise.all(promises).then(function(result) {
                    let petsRow = $('#petsRow');
                    let petTemplate = $('#petTemplate');
                    petsRow.empty();

                    for(i = 0; i < numberOfPets; i++) {
                        petTemplate.find('.panel-title').text('#' + i + ' ' + App.web3.toAscii(result[i][0]));
                        petTemplate.find('img').attr('src', App.images[i % App.images.length]);
                        petTemplate.find('.btn-adopt').attr('data-id', i);
                        petTemplate.find('.btn-approve-pet').attr('data-id', i);
                        petTemplate.find('.btn-reject-pet').attr('data-id', i);
                        petTemplate.find('.donation').attr('data-id', i);

                        let state = result[i][2].toNumber();
                        console.log(state);
                        if (state == 1) {
                            petTemplate.find('.btn-adopt').text('Pending').attr('disabled', true);
                            petTemplate.find('.petApproval').show();
                        } else if (state == 2) {
                            petTemplate.find('.btn-adopt').text('Adopted').attr('disabled', true);
                            petTemplate.find('.petApproval').hide();
                        } else {
                            petTemplate.find('.btn-adopt').text('Adopt').attr('disabled', false);
                            petTemplate.find('.petApproval').hide();
                        }

                        petsRow.prepend(petTemplate.html());
                    }
                });
            } else {
                $("#noPets").show();
            }
        }).catch(function(err) {
            console.log(err.message);
        });
    },

    addPet: function(event) {
        event.stopPropagation();
        let petName = $('#petName').val();

        let adoptionInstance;
        App.web3.eth.getAccounts(function(error, accounts) {
            if (error) {
                console.log(error);
            }

            let account = accounts[0];

            App.contracts.Adoption.deployed().then(function(instance) {
                adoptionInstance = instance;

                return adoptionInstance.addPet(petName, { from: account });
            }).then(function(result) {
                $('#addPetModal').modal('hide');
            }).catch(function(err) {
                console.log(err.message);
            });
        });
    },

    adopt: function(event) {
        event.preventDefault();

        let petId = parseInt($(event.target).data('id'));
        let donation = parseFloat($(".donation[data-id='" + petId + "']").val())

        App.web3.eth.getAccounts(function(error, accounts) {
            if (error) {
                console.log(error);
            }

            let account = accounts[0];

            App.contracts.Adoption.deployed().then(function(instance) {
                adoptionInstance = instance;

                return adoptionInstance.adopt(petId, {from: account, value: web3.toWei(donation)});
            }).catch(function(err) {
                console.log(err.message);
            });
        });
    }
};

$(function() {
    $(window).load(function() {
        App.initWeb3();
    });
});
