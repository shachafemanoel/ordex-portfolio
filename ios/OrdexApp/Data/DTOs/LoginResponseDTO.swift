import Foundation

struct LoginResponseDTO: Decodable {
    let user: UserDTO
    let token: String
}
