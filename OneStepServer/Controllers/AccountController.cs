using System.Collections;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace OneStepServer
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountController : ControllerBase
    {

        private readonly ApplicatonContext _context;
        
        public AccountController(ApplicatonContext applicatonContext)
        {
            _context = applicatonContext;
        }

        // [HttpGet(Name = "GetUser")]
        // public User GetUser()
        // {

        //     return new User
        //     {
        //         Id = 1,
        //         Username = "testuser",
        //         Email = ""
        //     };
        // }

        [Authorize]
        [HttpGet("profile")]
        public IActionResult GetProfile()
        {
                    return Ok(new
            {
                UserId = User.FindFirst("sub")?.Value,
                Email = User.FindFirst("email")?.Value
            });
        }
           
    }
}
