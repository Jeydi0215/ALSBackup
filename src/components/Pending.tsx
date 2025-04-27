import styles from '../css/Monitoring.module.css'
import Accept from '../components/Accept';
import Reject from '../components/Reject';

const Pending = () => {
    return(
        <div className={styles.Pending}>
                <table>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Action</th>
                    </tr>
                    <tr>
                        <td>John Doe</td>
                        <td>202112345@gmail.com </td>
                        <td className={styles.Hold}><Accept/> <Reject/>  </td>
                    </tr>
                    <tr>
                        <td>Jane Smith</td>
                        <td> 202112345@gmail.com </td>
                        <td className={styles.Hold}><Accept/> <Reject/>  </td>
                    </tr>

                    <tr>
                        <td>Jane Smith</td>
                        <td> 202112345@gmail.com </td>
                        <td className={styles.Hold}><Accept/> <Reject/>  </td>
                    </tr>
                </table>
        </div>
    )
}

export default Pending;