pragma solidity ^0.4.17;
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

contract Adoption is Ownable {
    enum PetState { CREATED, ADOPT_PENDING, ADOPT_ACCEPTED, ADOPT_REJECTED }

    modifier validPet(uint petId) {
        require(petId >= 0 && petId < pets.length);
        _;
    }

    struct Pet {
        bytes name;
        address adopter;
        uint donation;
        PetState state;
    }

    Pet[] public pets;

    event UpdatedPetState (
        uint id,
        bytes name,
        address adopter,
        uint donation,
        PetState state
    );

    event AddedPet(bytes name);

    function Adoption() public {
        owner = msg.sender;
    }

    // Adding a pet
    function addPet(bytes name) public onlyOwner returns (uint) {
        Pet memory newPet = Pet(name, address(0), 0, PetState.CREATED);
        pets.push(newPet);

        AddedPet(name);
        return pets.length - 1;
    }

    // Retrieving number of pets
    function getNumberOfPets() public view returns (uint) {
        return pets.length;
    }

    // Retrieving a pet
    function getPet(uint petId)
        validPet(petId)
        public
        view
        returns (bytes, address, PetState)
    {
        return (pets[petId].name, pets[petId].adopter, pets[petId].state);
    }

    // Concrete adoption
    function concreteAdoption(uint petId, bool approve)
        validPet(petId)
        public onlyOwner
        returns (uint)
    {
        Pet storage pet = pets[petId];
        require(pet.state == PetState.ADOPT_PENDING);

        if (approve) {
            owner.transfer(pet.donation);
            pet.state = PetState.ADOPT_ACCEPTED;
        } else {
            pet.adopter.transfer(pet.donation);
            pet.state = PetState.ADOPT_REJECTED;
        }

        UpdatedPetState(petId, pet.name, pet.adopter, pet.donation, pet.state);
        return petId;
    }

    // Adopting a pet
    function adopt(uint petId)
        validPet(petId)
        public payable
        returns (uint)
    {
        Pet storage pet = pets[petId];
        require(pet.state != PetState.ADOPT_PENDING && pet.state != PetState.ADOPT_ACCEPTED);

        pet.adopter = msg.sender;
        pet.donation = msg.value;
        pet.state = PetState.ADOPT_PENDING;

        pets[petId] = pet;

        UpdatedPetState(petId, pet.name, pet.adopter, pet.donation, pet.state);
        return petId;
    }
}
